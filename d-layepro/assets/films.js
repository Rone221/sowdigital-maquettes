/* ==========================================================================
   SowDigital · Maquette D · page Films (JS natif)
   Chargé après app.js : <script src="../assets/films.js" defer></script>

   1. Héros : bande démo de 3 plans drone muets (un mp4 à la fois, bouton pause,
      flèches, balayage ; mouvement réduit = affiches seules + bouton lecture)
   2. Mosaïque : grand format en tête, case d'appel qui comble la dernière rangée
   3. Filtres : compteur annoncé, retour en haut de grille, paramètre ?filtre=
   4. Lecteur : <dialog> avec la vidéo à la bonne largeur, titre et description,
      film précédent / suivant, vidéo arrêtée et déchargée à la fermeture
   ========================================================================== */
(() => {
  'use strict';

  const SD = window.SD || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduce.matches;
  const icon = (id, cls = 'icon') => (SD.icon ? SD.icon(id, cls) : '');
  const cld = (tpl, w, ratio) => tpl.replace('{W}', Math.round(w)).replace('{RATIO}', ratio ? (+ratio).toFixed(4) : '1');
  const rafThrottle = (fn) => {
    let queued = false;
    return (...a) => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fn(...a); }); };
  };

  const dataEl = $('#films-data');
  const FILMS = dataEl ? JSON.parse(dataEl.textContent) : [];
  const byUid = new Map(FILMS.map((f) => [f.uid, f]));

  /* 1. Héros : bande démo de plans drone ------------------------------------
     Un plan à la fois : son mp4 n'est demandé que lorsqu'il doit jouer (héros
     visible, lecture active), le suivant est préparé 3 s avant la fin.
     Fin du plan = plan suivant. Flèches, balayage et clavier changent de plan.
     Mouvement réduit : affiches fixes, rien ne se lance sans le bouton lecture. */
  function initHero() {
    const hero = $('[data-film-hero]');
    if (!hero) return;
    const slides = $$('[data-reel]', hero);
    const btn = $('[data-hero-toggle]', hero);
    if (!slides.length || !btn) return;
    const prev = $('[data-hero-prev]', hero);
    const next = $('[data-hero-next]', hero);
    const cur = $('[data-hero-current]', hero);
    const kicker = $('[data-hero-kicker]', hero);
    const live = $('[data-hero-live]', hero);
    const bar = $('[data-hero-progress]', hero);
    const mqMobile = window.matchMedia('(max-width: 767px)');
    const n = slides.length;
    const vid = (i) => $('video', slides[i]);
    let index = 0;
    let paused = reduced();
    let visible = false;
    let covered = false; // lecteur ouvert par-dessus

    // Affiche d'un plan (les suivantes ne sont demandées qu'au besoin)
    const poster = (i) => {
      $$('[data-src], [data-srcset]', slides[i]).forEach((el) => {
        if (el.dataset.srcset) { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); }
        if (el.dataset.src && el.tagName === 'IMG') { el.src = el.dataset.src; el.removeAttribute('data-src'); }
      });
    };
    const load = (v) => {
      if (v.getAttribute('src')) return;
      v.preload = 'auto';
      v.src = mqMobile.matches ? (v.dataset.srcMobile || v.dataset.src) : v.dataset.src;
    };
    let shown = null;
    const setBtn = () => {
      if (shown === paused) return;
      shown = paused;
      btn.innerHTML = icon(paused ? 'i-play' : 'i-pause');
      btn.setAttribute('aria-label', paused ? 'Lire les vidéos de fond' : 'Mettre les vidéos de fond en pause');
      hero.classList.toggle('is-paused', paused);
    };
    const sync = () => {
      slides.forEach((s, i) => {
        const v = vid(i);
        if (i !== index && !v.paused) v.pause();
      });
      const v = vid(index);
      if (!paused && visible && !covered && !document.hidden) {
        load(v);
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
      setBtn();
    };
    const go = (i, announce) => {
      const old = vid(index);
      index = (i + n) % n;
      poster(index);
      slides.forEach((s, k) => {
        const on = k === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
      });
      if (cur) cur.textContent = String(index + 1).padStart(2, '0');
      if (kicker) kicker.textContent = slides[index].dataset.kicker || '';
      if (live && announce) live.textContent = `Plan ${index + 1} sur ${n} : ${slides[index].dataset.kicker || ''}`;
      if (bar) bar.style.transform = 'scaleX(0)';
      const v = vid(index);
      if (v.getAttribute('src')) { try { v.currentTime = 0; } catch (err) { /* pas encore prêt */ } }
      // L'ancien plan s'arrête après le fondu, puis revient au début
      setTimeout(() => { if (vid(index) !== old) { old.pause(); old.classList.remove('is-playing'); try { old.currentTime = 0; } catch (err) { /* */ } } }, 1100);
      sync();
    };

    slides.forEach((s, i) => {
      const v = vid(i);
      v.muted = true;
      v.addEventListener('playing', () => v.classList.add('is-playing'));
      v.addEventListener('ended', () => { if (i === index && !paused) go(index + 1); });
      v.addEventListener('timeupdate', () => {
        if (i !== index || !v.duration) return;
        if (bar) bar.style.transform = `scaleX(${Math.min(1, v.currentTime / v.duration).toFixed(3)})`;
        if (v.duration - v.currentTime < 3) { const nx = (index + 1) % n; poster(nx); if (!paused) load(vid(nx)); }
      });
    });

    btn.addEventListener('click', () => { paused = !paused; sync(); });
    prev && prev.addEventListener('click', () => go(index - 1, true));
    next && next.addEventListener('click', () => go(index + 1, true));
    hero.addEventListener('keydown', (ev) => {
      if (ev.target.closest('a, input')) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(index - 1, true); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(index + 1, true); }
    });
    // Balayage tactile horizontal
    let sx = 0, sy = 0, tracking = false;
    hero.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'mouse') return; tracking = true; sx = ev.clientX; sy = ev.clientY; }, { passive: true });
    hero.addEventListener('pointerup', (ev) => {
      if (!tracking) return;
      tracking = false;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(index + (dx < 0 ? 1 : -1), true);
    }, { passive: true });
    hero.addEventListener('pointercancel', () => { tracking = false; });
    // La flèche « précédent » survolée : on prépare son affiche
    prev && prev.addEventListener('pointerenter', () => poster((index - 1 + n) % n), { once: true });

    document.addEventListener('visibilitychange', sync);
    document.addEventListener('films:player', (ev) => { covered = ev.detail.open; sync(); });
    mqReduce.addEventListener('change', () => { paused = reduced(); sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }, { threshold: 0.25 }).observe(hero);
    } else {
      visible = true; sync();
    }
    // Affiche du plan suivant une fois la page chargée (petit fichier, transition sans trou)
    window.addEventListener('load', () => setTimeout(() => poster(1 % n), 800), { once: true });
    setBtn();
  }

  /* 2. Mosaïque ---------------------------------------------------------------
     --cols vient du CSS (3/2/1 en paysage, 6/3/2 en vertical).
     Paysage, 2 colonnes et plus : la première vignette visible passe en 2x2.
     La case d'appel (.vfill) prend les cellules restantes de la dernière rangée,
     donc la grille reste pleine quel que soit le filtre. */
  const FEATURE_SIZES = '(min-width: 1100px) 67vw, 100vw';
  function layout() {
    $$('[data-vgroup]').forEach((group) => {
      const grid = $('.vmosaic', group);
      if (!grid) return;
      const cells = $$('.vcell', grid);
      const vis = cells.filter((c) => !c.hidden);
      const fill = $('.vfill', grid);
      group.hidden = vis.length === 0;
      if (!vis.length) return;
      const C = parseInt(getComputedStyle(grid).getPropertyValue('--cols'), 10) || 1;
      cells.forEach((c) => {
        c.classList.remove('vcell--feature');
        c.style.removeProperty('--cs');
        c.style.removeProperty('--rs');
      });
      let used = vis.length;
      if (grid.dataset.vmosaic === 'land' && C >= 2 && vis.length >= 3) {
        const f = vis[0];
        f.classList.add('vcell--feature');
        f.style.setProperty('--cs', '2');
        f.style.setProperty('--rs', '2');
        used += 3;
      }
      vis.forEach((c, i) => {
        c.style.setProperty('--i', String(Math.min(i, 12)));
        const img = $('img', c);
        if (!img) return;
        const want = c.classList.contains('vcell--feature') ? FEATURE_SIZES : img.dataset.sizes;
        if (want && img.sizes !== want) img.sizes = want;
      });
      const left = (C - (used % C)) % C;
      if (fill) {
        fill.hidden = left === 0;
        fill.style.setProperty('--cs', String(left || 1));
        fill.classList.toggle('vfill--wide', left >= 2);
      }
    });
  }

  /* 3. Filtres ------------------------------------------------------------------ */
  function initFilters() {
    const wrap = $('#films-grille');
    if (!wrap) return;
    const status = $('[data-films-status]');
    const bar = $('.filterbar');
    const header = $('.site-header');
    wrap.addEventListener('sd:filter', (e) => {
      const { value, count } = e.detail;
      layout();
      const btn = $(`[data-filter="${value}"]`);
      if (status) {
        const name = value === '*' || !btn ? '' : ` · ${btn.dataset.name}`;
        status.innerHTML = `<b>${count}</b> ${count > 1 ? 'vidéos' : 'vidéo'}${name}`;
      }
      // Sur mobile la rangée de filtres défile : on centre le filtre actif
      const list = btn && btn.parentElement;
      if (list && list.scrollWidth > list.clientWidth + 2) {
        const lr = list.getBoundingClientRect(), br = btn.getBoundingClientRect();
        list.scrollBy({ left: (br.left + br.width / 2) - (lr.left + lr.width / 2), behavior: reduced() ? 'auto' : 'smooth' });
      }
      // Petite entrée des vignettes (désactivée en mouvement réduit par la règle globale)
      wrap.classList.remove('is-filtering');
      void wrap.offsetWidth;
      wrap.classList.add('is-filtering');
      // Si on a filtré depuis le bas de la grille, on remonte au début des résultats
      const offset = (header ? header.offsetHeight : 0) + (bar ? bar.offsetHeight : 0);
      const top = wrap.getBoundingClientRect().top;
      if (top < offset - 2) window.scrollTo({ top: window.scrollY + top - offset, behavior: reduced() ? 'auto' : 'smooth' });
      // Le filtre se partage par l'adresse : films/?filtre=drone
      try {
        const url = new URL(window.location.href);
        if (value === '*') url.searchParams.delete('filtre'); else url.searchParams.set('filtre', value);
        history.replaceState(null, '', url);
      } catch (err) { /* bac à sable : sans conséquence */ }
    });
    const wanted = new URLSearchParams(window.location.search).get('filtre');
    const btn = wanted && $$('[data-filter]').find((b) => b.dataset.filter === wanted);
    if (btn) btn.click();
  }

  /* 4. Lecteur ------------------------------------------------------------------- */
  const player = (() => {
    let dlg, vid, els = {}, list = [], i = 0, opener = null;
    const LADDER = [480, 640, 960, 1280, 1920];

    // Largeur de fichier : ce que l'écran affiche vraiment, jamais plus que l'original
    const pickWidth = (f) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const ar = f.w / f.h;
      const cssW = Math.min(window.innerWidth, 1280, Math.max(240, window.innerHeight - 300) * ar);
      const need = cssW * dpr;
      const w = LADDER.find((x) => x >= need) || LADDER[LADDER.length - 1];
      return Math.min(w, f.w);
    };

    const build = () => {
      dlg = document.createElement('dialog');
      dlg.className = 'vdialog fplayer';
      dlg.setAttribute('aria-labelledby', 'fp-title');
      dlg.innerHTML = `
        <div class="vd__top">
          <p class="lb__count" aria-hidden="true"></p>
          <div class="fplayer__actions">
            <button class="btn-round btn-round--sm" type="button" data-fp-prev aria-label="Film précédent">${icon('i-arrow-left')}</button>
            <button class="btn-round btn-round--sm" type="button" data-fp-next aria-label="Film suivant">${icon('i-arrow')}</button>
            <button class="btn-round btn-round--sm" type="button" data-fp-close aria-label="Fermer le lecteur">${icon('i-close')}</button>
          </div>
        </div>
        <div class="fplayer__stage">
          <video class="fplayer__video" controls playsinline preload="none"></video>
        </div>
        <div class="fplayer__info">
          <div class="fplayer__inner">
            <p class="fplayer__meta"></p>
            <h2 class="fplayer__title" id="fp-title"></h2>
            <p class="fplayer__desc"></p>
            <p class="fplayer__cta"><a class="link-arrow" target="_blank" rel="noopener">Un film comme celui-ci ${icon('i-arrow')}<span class="sr-only">(WhatsApp, nouvel onglet)</span></a></p>
          </div>
        </div>`;
      document.body.appendChild(dlg);
      vid = $('video', dlg);
      els = {
        count: $('.lb__count', dlg), meta: $('.fplayer__meta', dlg), title: $('.fplayer__title', dlg),
        desc: $('.fplayer__desc', dlg), cta: $('.fplayer__cta a', dlg),
        prev: $('[data-fp-prev]', dlg), next: $('[data-fp-next]', dlg),
      };
      $('[data-fp-close]', dlg).addEventListener('click', () => dlg.close());
      els.prev.addEventListener('click', () => show(i - 1));
      els.next.addEventListener('click', () => show(i + 1));
      dlg.addEventListener('keydown', (e) => {
        if (e.target === vid) return; // les flèches servent à avancer dans la vidéo
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
      });
      // Clic sur le fond = fermer
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.classList.contains('fplayer__stage')) dlg.close();
      });
      dlg.addEventListener('close', () => {
        vid.pause();
        vid.removeAttribute('src');
        vid.removeAttribute('poster');
        vid.load(); // libère le flux
        document.body.classList.remove('is-locked');
        document.dispatchEvent(new CustomEvent('films:player', { detail: { open: false } }));
        const back = $(`[data-film="${list[i]}"]`);
        const target = back && back.offsetParent !== null ? back : opener;
        if (target) target.focus();
      });
    };

    function show(n) {
      i = (n + list.length) % list.length;
      const f = byUid.get(list[i]);
      if (!f) return;
      const ar = f.w / f.h;
      dlg.style.setProperty('--ar-n', ar.toFixed(4));
      dlg.classList.toggle('is-vertical', ar < 1);
      vid.pause();
      vid.setAttribute('width', f.w);
      vid.setAttribute('height', f.h);
      vid.poster = cld(f.poster, Math.min(f.w, 1280), ar);
      vid.src = cld(f.mp4, pickWidth(f));
      els.count.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(list.length).padStart(2, '0')}`;
      els.meta.innerHTML = '';
      [f.tags.join(' · '), f.dur, f.format, f.ctx].filter(Boolean).forEach((t) => {
        const s = document.createElement('span');
        s.textContent = t;
        els.meta.appendChild(s);
      });
      els.title.textContent = f.title;
      els.desc.textContent = f.desc;
      if (SD.wa) els.cta.href = SD.wa(`Bonjour SowDigital, j'ai vu le film « ${f.title} » sur votre site. Je souhaite un devis vidéo.\nÉvénement : \nDate : \nLieu : `);
      const solo = list.length < 2;
      els.prev.hidden = solo;
      els.next.hidden = solo;
      const p = vid.play();
      if (p && p.catch) p.catch(() => {});
    }

    function open(uid, from) {
      if (!dlg) build();
      // La liste suit le filtre actif et l'ordre affiché (paysage puis vertical)
      list = $$('[data-film]').filter((b) => b.offsetParent !== null).map((b) => b.dataset.film);
      if (!list.includes(uid)) list = [uid];
      opener = from;
      dlg.showModal();
      document.body.classList.add('is-locked');
      document.dispatchEvent(new CustomEvent('films:player', { detail: { open: true } }));
      show(list.indexOf(uid));
      vid.focus({ preventScroll: true });
    }

    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-film]');
      if (!b || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      open(b.dataset.film, b);
    });
    return { open };
  })();
  SD.films = { open: player.open, layout };

  /* Démarrage ---------------------------------------------------------------------- */
  function init() {
    initHero();
    layout();
    initFilters();
    ['(max-width: 1099px)', '(max-width: 699px)'].forEach((q) => window.matchMedia(q).addEventListener('change', layout));
    window.addEventListener('resize', rafThrottle(layout));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
