/* Nube Games · main.js · vanilla, no library, no tracker */

/* =========================================================
   CONFIGURATION : les seules lignes à modifier au quotidien
   ========================================================= */
const SITE = {
  // Formulaire : identifiant FormSubmit (chaîne aléatoire, l'adresse e-mail n'apparaît jamais dans le code)
  formId: 'FORM_ID',
  // URL du jeu en ligne. Vide = bouton « Bientôt disponible ».
  playUrl: '',
  // Mettre true pour afficher le jeu directement dans la page (iframe) au lieu d'un lien.
  playEmbed: false,
  // Lien GitHub (affiché dans le footer seulement s'il est renseigné).
  github: ''
};

(() => {
  const doc = document.documentElement;
  doc.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Intro ---------- */
  const start = () => requestAnimationFrame(() => doc.classList.add('ready'));
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(start);
  } else start();

  /* ---------- Contact form (FormSubmit, AJAX) ---------- */
  const form = $('#contact');
  if (form) {
    const status = $('#form-status'), send = $('.form-send', form), label = $('.send-label', form);
    const say = (msg, cls) => { status.textContent = msg; status.className = 'form-status ' + (cls || ''); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      let ok = true;
      ['f-name', 'f-email'].forEach(id => {
        const f = document.getElementById(id);
        const bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
        f.classList.toggle('bad', bad); f.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad && ok) { f.focus(); ok = false; }
      });
      if (!ok) return say('Il manque une carte : vérifiez les champs en rouge.', 'err');
      if (form._honey.value) return say('C\'est reçu. Votre place est gardée.', 'ok');
      if (!SITE.formId || SITE.formId === 'FORM_ID') return say('La table ouvre très bientôt : revenez dans quelques jours.', 'err');
      const d = new FormData(form);
      const payload = {
        _subject: `[nubegames.fr] ${d.get('motif')} · ${d.get('name')}`,
        _template: 'table',
        _captcha: 'false',
        Motif: d.get('motif'), name: d.get('name'), email: d.get('email'), message: d.get('message') || '(pas de message)'
      };
      send.disabled = true; form.classList.add('rolling'); label.textContent = 'Envoi…'; say('');
      try {
        const r = await fetch(`https://formsubmit.co/ajax/${SITE.formId}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload)
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || String(j.success) !== 'true') throw new Error(j.message || r.status);
        form.reset(); say('C\'est reçu. Votre place est gardée, on revient vers vous.', 'ok');
      } catch (err) {
        say('Le dé est tombé de la table. Réessayez dans un instant.', 'err');
      } finally {
        send.disabled = false; form.classList.remove('rolling'); label.textContent = 'Envoyer';
      }
    });
  }
  if (SITE.github) { const li = $('[data-github]'); li.hidden = false; li.querySelector('a').href = SITE.github; }
  const play = $('#play-btn');
  if (SITE.playUrl) {
    play.removeAttribute('aria-disabled'); play.removeAttribute('role');
    play.href = SITE.playUrl;
    $('.play-label', play).textContent = 'Jouer';
    if (SITE.playEmbed) {
      const root = $('#game-root');
      play.addEventListener('click', e => {
        e.preventDefault();
        if (!root.firstChild) {
          const f = document.createElement('iframe');
          f.src = SITE.playUrl; f.title = 'Fields of Fire, version en ligne'; f.allow = 'fullscreen';
          root.appendChild(f);
        }
        root.hidden = false; root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      });
    }
  } else {
    play.addEventListener('click', e => e.preventDefault());
  }
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll (with stagger) ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .14, rootMargin: '0px 0px -60px 0px' });
  const stagger = (sel) => $$(sel).forEach((el, i) => el.style.setProperty('--d', (i * 0.1) + 's'));
  stagger('.reveal-grid .locked'); stagger('.steps .step'); stagger('.pt-list li');
  $$('.reveal, .step').forEach(el => io.observe(el));

  /* ---------- Nav: solid after hero, hide on scroll down, active link ---------- */
  const nav = $('#nav'); let lastY = scrollY;
  const onNav = () => {
    const y = scrollY;
    nav.classList.toggle('solid', y > 40);
    nav.classList.toggle('hide', y > lastY && y > innerHeight * .6 && !nav.contains(document.activeElement));
    lastY = y;
  };
  addEventListener('scroll', onNav, { passive: true }); onNav();
  const links = $$('.nav-links a');
  const secIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['fields-of-fire', 'projet', 'jouer', 'playtest'].forEach(id => { const s = document.getElementById(id); if (s) secIO.observe(s); });

  /* ---------- Marquee: seamless loop, speeds up with scroll ---------- */
  const mq = $('#marquee');
  mq.innerHTML += mq.innerHTML;
  if (!reduce) {
    let x = 0, boost = 0, prevY = scrollY, mqVisible = true;
    new IntersectionObserver(([e]) => { mqVisible = e.isIntersecting; }).observe(mq);
    const tick = () => {
      const dy = scrollY - prevY; prevY = scrollY;
      boost += (Math.min(Math.abs(dy), 60) * .12 - boost) * .1;
      if (mqVisible) {
        x -= .45 + boost;
        const half = mq.scrollWidth / 2;
        if (-x >= half) x += half;
        mq.style.transform = `translate3d(${x}px,0,0)`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if (reduce) return; // everything below is motion only

  /* ---------- Hero: pointer parallax + spotlight ---------- */
  const hero = $('.hero');
  const layers = $$('[data-depth]', hero).map(el => ({ el, d: +el.dataset.depth }));
  let px = 0, py = 0, cx = 0, cy = 0, heroVisible = true, sy = 0;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  if (fine) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5;
      hero.style.setProperty('--mx', e.clientX - r.left + 'px');
      hero.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  }
  const heroInner = $('.hero-inner');
  const heroLoop = () => {
    if (heroVisible) {
      cx += (px - cx) * .06; cy += (py - cy) * .06; sy = scrollY;
      layers.forEach(({ el, d }) => {
        el.style.transform = `translate3d(${cx * d * 40}px, ${cy * d * 40 + sy * d * .25}px, 0)`;
      });
      heroInner.style.transform = `translate3d(0, ${sy * .18}px, 0)`;
      heroInner.style.opacity = Math.max(0, 1 - sy / (innerHeight * .85));
    }
    requestAnimationFrame(heroLoop);
  };
  requestAnimationFrame(heroLoop);

  /* ---------- Hero: embers (canvas) ---------- */
  const cv = $('#embers'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, parts = [];
  const COLORS = ['232,211,174', '240,107,196', '255,106,95', '169,139,255'];
  const spawn = (init) => ({
    x: Math.random() * W, y: init ? Math.random() * H : H + 10,
    r: Math.random() * 1.6 + .4, v: Math.random() * .35 + .12,
    w: Math.random() * Math.PI * 2, ws: Math.random() * .012 + .004,
    a: Math.random() * .55 + .15, c: COLORS[(Math.random() * COLORS.length) | 0]
  });
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.offsetWidth; H = cv.offsetHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = W < 600 ? 28 : 64;
    parts = Array.from({ length: n }, () => spawn(true));
  };
  size();
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(size, 200); });
  const draw = () => {
    if (heroVisible && !document.hidden) {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.y -= p.v; p.w += p.ws; p.x += Math.sin(p.w) * .3 - cx * .4;
        const fade = Math.min(1, p.y / (H * .5));
        if (p.y < -10 || fade <= 0) Object.assign(p, spawn(false));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = `rgba(${p.c},${p.a * fade})`; ctx.fill();
      }
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  /* ---------- Scroll parallax outside hero ---------- */
  const scrollers = $$('[data-scroll]').map(el => ({ el, k: +el.dataset.scroll, sec: el.closest('section') }));
  const scrollLoop = () => {
    scrollers.forEach(({ el, k, sec }) => {
      const r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2);
      el.style.transform = `translate3d(0, ${p * k}px, 0)`;
    });
  };
  addEventListener('scroll', () => requestAnimationFrame(scrollLoop), { passive: true }); scrollLoop();

  if (!fine) return; // below: pointer-only niceties

  /* ---------- Cover card: 3D tilt + glare ---------- */
  const card = $('#cover-card');
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.transition = 'transform .12s linear';
    card.style.transform = `rotateY(${(x - .5) * 14}deg) rotateX(${(.5 - y) * 12}deg) scale(1.02)`;
    card.style.setProperty('--gx', x * 100 + '%'); card.style.setProperty('--gy', y * 100 + '%');
  });
  card.addEventListener('pointerleave', () => { card.style.transition = ''; card.style.transform = ''; });

  /* ---------- Magnetic buttons ---------- */
  $$('.magnetic').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  /* ---------- Cursor ---------- */
  const cur = document.createElement('div'); cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cur);
  let tx = -100, ty = -100, kx = -100, ky = -100;
  addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; cur.style.opacity = 1; });
  document.addEventListener('pointerleave', () => { cur.style.opacity = 0; });
  document.addEventListener('pointerover', e => cur.classList.toggle('big', !!e.target.closest('a,button,.locked,.cover-card')));
  const curLoop = () => { kx += (tx - kx) * .2; ky += (ty - ky) * .2; cur.style.transform = `translate3d(${kx}px,${ky}px,0) translate(-50%,-50%)`; requestAnimationFrame(curLoop); };
  requestAnimationFrame(curLoop);
})();
