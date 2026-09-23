/* Nube Games · main.js · vanilla, sans bibliothèque, sans tracker */

/* =========================================================
   CONFIGURATION : les seules lignes à modifier au quotidien
   ========================================================= */
const SITE = {
  // Le formulaire écrit directement dans la table `bug_reports` du projet Supabase du jeu,
  // avec `context.source = 'site'`. Les messages sont donc lisibles au même endroit que les
  // signalements du jeu : /fields-of-fire/bugs.html
  supabaseUrl: 'https://wucrnsmogswphekitodw.supabase.co',
  supabaseKey: 'sb_publishable_1ah4C-mmBA8nhFTRGsx1LQ_qPzUB_eM',
  // Adresse affichée en secours si l'envoi échoue. Vide = rien n'est proposé.
  contactMail: 'nubegamesfr@gmail.com',
  // URL du jeu en ligne.
  playUrl: '/fields-of-fire/'
};

(() => {
  'use strict';
  const doc = document.documentElement;
  doc.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- barre de navigation collante ---------- */
  const nav = $('#nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 8);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- apparition au défilement ---------- */
  const reveals = $$('.reveal');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach(el => io.observe(el));
  }

  /* ---------- liens du jeu ---------- */
  if (SITE.playUrl) $$('a[href="/fields-of-fire/"]').forEach(a => { a.href = SITE.playUrl; });

  /* ---------- formulaire ---------- */
  const form = $('#contact');
  if (!form) return;
  const msg = $('#form-msg');
  const t = (fr, en) => (doc.lang === 'en' ? en : fr);

  const say = (txt, cls) => { if (!msg) return; msg.textContent = txt; msg.className = 'form-msg ' + (cls || ''); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.querySelector('[name="_honey"]').value) return;       // piège à robots

    const name = form.querySelector('[name="name"]');
    const mail = form.querySelector('[name="email"]');
    if (!name.value.trim() || !mail.checkValidity()) {
      say(t('Un nom et un e-mail valide, et c’est parti.', 'A name and a valid e-mail, and we’re set.'), 'ko');
      (!name.value.trim() ? name : mail).focus();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    say(t('Envoi…', 'Sending…'));
    try {
      const d = Object.fromEntries(new FormData(form));
      const r = await fetch(SITE.supabaseUrl + '/rest/v1/bug_reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SITE.supabaseKey, Prefer: 'return=minimal' },
        body: JSON.stringify({
          message: (d.message || '').slice(0, 4000),
          contact: [d.name, d.email].filter(Boolean).join(' · ').slice(0, 200),
          context: { source: 'site', motif: d.motif || null, lang: doc.lang || 'fr', ua: navigator.userAgent.slice(0, 200) }
        })
      });
      if (!r.ok) throw new Error(r.status);
      form.reset();
      say(t('C’est parti. On vous répond vite.', 'Sent. We’ll get back to you shortly.'), 'ok');
    } catch (err) {
      say(SITE.contactMail
        ? t('L’envoi a échoué. Écrivez-nous à ' + SITE.contactMail + '.', 'Sending failed. Write to ' + SITE.contactMail + '.')
        : t('L’envoi a échoué. Réessayez dans un moment.', 'Sending failed. Please try again in a moment.'), 'ko');
    } finally {
      btn.disabled = false;
    }
  });
})();
