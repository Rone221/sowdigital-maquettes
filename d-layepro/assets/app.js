/* ==========================================================================
   SowDigital · Maquette D · comportements partagés (JS natif, sans dépendance)
   Chargé en fin de <body> par Accueil, Photos et Films :
     <script src="assets/app.js" defer></script>   (ou ../assets/app.js)

   Tout est déclaratif via des attributs data-* et s'initialise seul.
   Les pages qui créent du contenu en JS peuvent appeler window.SD.* :
     SD.cld(tpl, w, ratio)            URL Cloudinary depuis un gabarit {W}/{RATIO}
     SD.srcset(tpl, widths, maxW, r)  attribut srcset prêt à poser
     SD.reveal(el)                    observer un élément ajouté après coup
     SD.lightbox.open(items, i, btn)  ouvrir la visionneuse sur une liste
     SD.video.open({src, poster, title}, btn)  lecteur vidéo en dialog
     SD.filters(root)                 brancher des filtres (aria-pressed)
     SD.wa(message)                   lien WhatsApp avec message pré-rempli

   Sommaire
   1. Utilitaires          7. Mots qui s'allument
   2. En-tête              8. Lightbox
   3. Menu mobile          9. Lecteur vidéo
   4. Apparition           10. Boucles vidéo muettes
   5. Compteurs            11. Filtres
   6. Slider + carrousel   12. Retour en haut
                           13. Pause d'un défilement
   ========================================================================== */
(() => {
  'use strict';

  const SD = (window.SD = window.SD || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduce.matches;
  SD.reduced = reduced;

  /* 1. Utilitaires ---------------------------------------------------------- */
  const WA_NUMBER = '221773718484';
  SD.wa = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

  // Gabarit Cloudinary : {W} = largeur (jamais au-delà de l'original), {RATIO} = rapport décimal
  SD.cld = (tpl, w, ratio) => tpl.replace('{W}', Math.round(w)).replace('{RATIO}', ratio ? (+ratio).toFixed(4) : '1');
  SD.srcset = (tpl, widths, maxW = Infinity, ratio) => {
    const list = widths.filter((w) => w <= maxW);
    if (!list.length) list.push(Math.min(maxW, widths[0]));
    return list.map((w) => `${SD.cld(tpl, w, ratio)} ${w}w`).join(', ');
  };

  // Icône du sprite (chemin relatif calculé depuis la balise <script> d'app.js)
  const scriptSrc = (document.currentScript && document.currentScript.getAttribute('src')) || 'assets/app.js';
  const ASSETS = scriptSrc.replace(/app\.js.*$/, '');
  SD.icon = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="${ASSETS}icons.svg#${id}"/></svg>`;

  // Exécuter une fonction au plus une fois par frame
  const rafThrottle = (fn) => {
    let queued = false;
    return (...args) => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(...args); });
    };
  };

  /* 2. En-tête : transparent sur le héros, opaque après défilement ------------ */
  function initHeader() {
    const header = $('[data-header]');
    if (!header) return;
    const always = header.dataset.header === 'solid';
    const update = () => header.classList.toggle('is-solid', always || window.scrollY > 40);
    update();
    window.addEventListener('scroll', rafThrottle(update), { passive: true });
  }

  /* 3. Menu mobile plein écran (<dialog id="menu">) --------------------------- */
  function initMenu() {
    const menu = $('#menu');
    if (!menu || typeof menu.showModal !== 'function') return;
    const openers = $$('[data-menu-open]');
    const setExpanded = (v) => openers.forEach((b) => b.setAttribute('aria-expanded', String(v)));
    openers.forEach((btn) => btn.addEventListener('click', () => {
      menu.showModal();
      document.body.classList.add('is-locked');
      setExpanded(true);
    }));
    $$('[data-menu-close]', menu).forEach((b) => b.addEventListener('click', () => menu.close()));
    // Un lien d'ancre ferme le menu avant de défiler
    $$('a', menu).forEach((a) => a.addEventListener('click', () => menu.close()));
    menu.addEventListener('close', () => {
      document.body.classList.remove('is-locked');
      setExpanded(false);
    });
    // Repasser en bureau ferme le menu
    window.matchMedia('(min-width: 1080px)').addEventListener('change', (e) => { if (e.matches && menu.open) menu.close(); });
  }

  /* 4. Apparition au défilement [data-reveal] (+ data-reveal-delay en ms) ----- */
  let revealIO = null;
  SD.reveal = (el) => {
    if (reduced() || !('IntersectionObserver' in window)) { el.classList.add('is-in'); return; }
    if (el.dataset.revealDelay) el.style.setProperty('--d', `${+el.dataset.revealDelay / 1000}s`);
    revealIO.observe(el);
  };
  function initReveal() {
    if ('IntersectionObserver' in window) {
      revealIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    }
    $$('[data-reveal]').forEach(SD.reveal);
  }

  /* 5. Compteurs [data-count="696"] (+ data-count-duration) -------------------
     La valeur finale est déjà écrite dans le HTML : sans JS, le chiffre est juste. */
  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length || reduced() || !('IntersectionObserver' in window)) return;
    const fmt = new Intl.NumberFormat('fr-FR');
    const run = (el) => {
      const target = +el.dataset.count;
      const dur = +(el.dataset.countDuration || 1800);
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt.format(Math.round(target * eased));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    els.forEach((el) => {
      // Les lecteurs d'écran lisent la valeur finale (aria-label), pas l'animation
      const box = el.closest('[data-count-label]') || el.parentElement;
      if (box && !box.hasAttribute('aria-label')) box.setAttribute('aria-label', box.textContent.replace(/\s+/g, ' ').trim());
      el.textContent = '0';
      io.observe(el);
    });
  }

  /* 6a. Slider [data-slider] (héros en fondu) ---------------------------------
     Enfants : [data-slide] (x N), [data-slider-prev], [data-slider-next],
     [data-slider-toggle] (pause/lecture), [data-slider-current], [data-slider-total],
     [data-slider-progress] (barre). Option : data-autoplay="6500" (ms, 0 = aucun).
     Clavier : flèches gauche/droite quand le focus est dans le slider. Balayage tactile.
     Événement émis : "sd:slide" avec detail.index. */
  function initSlider(root) {
    const slides = $$('[data-slide]', root);
    if (slides.length < 2) return;
    const prev = $('[data-slider-prev]', root);
    const next = $('[data-slider-next]', root);
    const toggle = $('[data-slider-toggle]', root);
    const cur = $('[data-slider-current]', root);
    const tot = $('[data-slider-total]', root);
    const bar = $('[data-slider-progress]', root);
    const live = $('[data-slider-live]', root);
    const delay = +(root.dataset.autoplay || 0);
    root.style.setProperty('--autoplay', `${delay}ms`);

    let index = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
    let playing = delay > 0 && !reduced();
    let hold = false; // pause temporaire (survol, focus, onglet caché, hors écran)
    let timer = null;
    let inView = true;

    const pad = (n) => String(n).padStart(2, '0'); // « 01 / 04 » sur les trois pages
    if (tot) tot.textContent = pad(slides.length);

    const restartBar = () => {
      if (!bar) return;
      bar.classList.remove('is-running');
      void bar.offsetWidth; // relance l'animation CSS
      if (playing && !hold) bar.classList.add('is-running');
    };
    const schedule = () => {
      clearTimeout(timer);
      if (playing && !hold && inView) timer = setTimeout(() => go(index + 1), delay);
      root.classList.toggle('is-paused', !playing || hold);
      restartBar();
    };
    const render = () => {
      slides.forEach((s, i) => {
        const on = i === index;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
        s.inert = !on;
      });
      if (cur) cur.textContent = pad(index + 1);
      if (live) live.textContent = `Diapositive ${index + 1} sur ${slides.length} : ${slides[index].getAttribute('aria-label') || ''}`;
      root.dispatchEvent(new CustomEvent('sd:slide', { detail: { index } }));
    };
    function go(i) {
      index = (i + slides.length) % slides.length;
      render();
      schedule();
    }
    const setPlaying = (v) => {
      playing = v;
      if (toggle) {
        toggle.setAttribute('aria-label', v ? 'Mettre le diaporama en pause' : 'Lancer le diaporama');
        toggle.innerHTML = SD.icon(v ? 'i-pause' : 'i-play');
      }
      if (live) live.setAttribute('aria-live', v ? 'off' : 'polite');
      schedule();
    };

    prev && prev.addEventListener('click', () => go(index - 1));
    next && next.addEventListener('click', () => go(index + 1));
    toggle && toggle.addEventListener('click', () => setPlaying(!playing));

    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    // Survol ou focus clavier : on suspend sans perdre l'état « lecture »
    root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hold = true; schedule(); } });
    root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hold = false; schedule(); } });
    root.addEventListener('focusin', () => { hold = true; schedule(); });
    root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) { hold = false; schedule(); } });
    document.addEventListener('visibilitychange', () => { hold = document.hidden; schedule(); });

    // Hors écran : pas d'autoplay
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule(); }, { threshold: 0.2 }).observe(root);
    }

    // Balayage tactile (horizontal dominant)
    let sx = 0, sy = 0, tracking = false;
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      tracking = true; sx = e.clientX; sy = e.clientY;
    }, { passive: true });
    root.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(index + (dx < 0 ? 1 : -1));
    }, { passive: true });
    root.addEventListener('pointercancel', () => { tracking = false; });

    mqReduce.addEventListener('change', () => setPlaying(delay > 0 && !reduced()));

    render();
    setPlaying(playing);
  }

  /* 6b. Carrousel [data-carousel] (piste à défilement natif + flèches) --------
     Enfants : [data-carousel-track], [data-carousel-prev], [data-carousel-next],
     [data-carousel-progress] (span dont --p varie de 0 à 1). */
  function initCarousel(root) {
    const track = $('[data-carousel-track]', root);
    if (!track) return;
    const prev = $('[data-carousel-prev]', root);
    const next = $('[data-carousel-next]', root);
    const prog = $('[data-carousel-progress]', root);
    const step = () => {
      const card = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card ? (card.getBoundingClientRect().width + gap) : track.clientWidth * 0.8;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const x = track.scrollLeft;
      if (prev) prev.disabled = x <= 2;
      if (next) next.disabled = x >= max - 2;
      if (prog) {
        const visible = track.clientWidth / track.scrollWidth;
        prog.style.setProperty('--p', Math.min(1, visible + (max > 0 ? (x / max) * (1 - visible) : 1)).toFixed(3));
      }
    };
    prev && prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduced() ? 'auto' : 'smooth' }));
    next && next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduced() ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', rafThrottle(update), { passive: true });
    window.addEventListener('resize', rafThrottle(update));
    update();
  }

  /* 7. Mots qui s'allument [data-words] ----------------------------------------
     Le texte est découpé en <span class="w">. Les mots dans <em> deviennent jaunes.
     L'allumage suit la position de la phrase dans la fenêtre. */
  function initWords() {
    $$('[data-words]').forEach((el) => {
      const words = [];
      const split = (node, accent) => {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              const s = document.createElement('span');
              s.className = accent ? 'w w--accent' : 'w';
              s.textContent = part;
              words.push(s);
              frag.appendChild(s);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1) {
            split(child, accent || child.tagName === 'EM');
          }
        });
      };
      split(el, false);
      if (reduced()) { words.forEach((w) => w.classList.add('is-lit')); return; }
      const update = () => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // Début : haut de la phrase à 88 % de l'écran. Fin : bas de la phrase à 55 %.
        const start = vh * 0.88, end = vh * 0.55;
        const total = (r.height + start - end) || 1;
        const p = Math.min(1, Math.max(0, (start - r.top) / total));
        const lit = Math.round(p * words.length);
        words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
      };
      update();
      window.addEventListener('scroll', rafThrottle(update), { passive: true });
      window.addEventListener('resize', rafThrottle(update));
    });
  }

  /* 8. Lightbox ------------------------------------------------------------------
     Déclaratif : un conteneur [data-lightbox] et des liens [data-lb-item] dedans.
       <a data-lb-item href="grande.jpg" data-srcset="..." data-caption="..." data-meta="...">
         <img alt="..."></a>
     Les éléments masqués (filtres, attribut hidden) sont ignorés.
     Programmatique : SD.lightbox.open([{src, srcset, alt, caption, meta}], index, boutonOrigine) */
  SD.lightbox = (() => {
    let dlg, img, cap, count, items = [], i = 0, opener = null;
    const build = () => {
      dlg = document.createElement('dialog');
      dlg.className = 'lightbox';
      dlg.setAttribute('aria-label', 'Visionneuse photo');
      dlg.innerHTML = `
        <div class="lb__top">
          <p class="lb__count" aria-live="polite"></p>
          <button class="btn-round btn-round--sm" type="button" data-lb-close aria-label="Fermer la visionneuse">${SD.icon('i-close')}</button>
        </div>
        <div class="lb__stage">
          <img class="lb__img" alt="" decoding="async">
          <button class="btn-round lb__nav lb__nav--prev" type="button" data-lb-prev aria-label="Photo précédente">${SD.icon('i-arrow-left')}</button>
          <button class="btn-round lb__nav lb__nav--next" type="button" data-lb-next aria-label="Photo suivante">${SD.icon('i-arrow')}</button>
        </div>
        <div class="lb__cap"></div>`;
      document.body.appendChild(dlg);
      img = $('.lb__img', dlg); cap = $('.lb__cap', dlg); count = $('.lb__count', dlg);
      $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
      $('[data-lb-prev]', dlg).addEventListener('click', () => show(i - 1));
      $('[data-lb-next]', dlg).addEventListener('click', () => show(i + 1));
      dlg.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
      });
      // Clic sur le fond = fermer
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lb__stage')) dlg.close(); });
      dlg.addEventListener('close', () => { document.body.classList.remove('is-locked'); img.removeAttribute('src'); img.removeAttribute('srcset'); if (opener) opener.focus(); });
      img.addEventListener('load', () => img.classList.remove('is-loading'));
      // Balayage
      let sx = 0;
      const stage = $('.lb__stage', dlg);
      stage.addEventListener('pointerdown', (e) => { sx = e.clientX; }, { passive: true });
      stage.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'mouse') return;
        const dx = e.clientX - sx;
        if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
      }, { passive: true });
    };
    const preload = (it) => { if (!it) return; const p = new Image(); if (it.srcset) { p.sizes = '100vw'; p.srcset = it.srcset; } p.src = it.src; };
    function show(n) {
      i = (n + items.length) % items.length;
      const it = items[i];
      img.classList.add('is-loading');
      img.alt = it.alt || '';
      if (it.srcset) { img.sizes = '(max-width: 767px) 100vw, 86vw'; img.srcset = it.srcset; } else { img.removeAttribute('srcset'); }
      img.src = it.src;
      if (img.complete) img.classList.remove('is-loading');
      count.innerHTML = `<b>${i + 1}</b> / ${items.length}`;
      cap.innerHTML = '';
      if (it.caption) { const s = document.createElement('strong'); s.textContent = it.caption; cap.appendChild(s); }
      if (it.meta) { const m = document.createElement('span'); m.textContent = it.meta; cap.appendChild(m); }
      const solo = items.length < 2;
      $$('.lb__nav', dlg).forEach((b) => { b.hidden = solo; });
      preload(items[(i + 1) % items.length]);
      preload(items[(i - 1 + items.length) % items.length]);
    }
    function open(list, start = 0, from = null) {
      if (!dlg) build();
      items = list; opener = from;
      show(start);
      dlg.showModal();
      document.body.classList.add('is-locked');
    }
    // Délégation : marche aussi pour le contenu injecté plus tard
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lb-item]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const group = a.closest('[data-lightbox]');
      if (!group) return;
      e.preventDefault();
      const nodes = $$('[data-lb-item]', group).filter((n) => !n.closest('[hidden]') && n.offsetParent !== null);
      const list = nodes.map((n) => {
        const im = $('img', n);
        return { src: n.getAttribute('href'), srcset: n.dataset.srcset || '', alt: im ? im.alt : '', caption: n.dataset.caption || '', meta: n.dataset.meta || '' };
      });
      open(list, Math.max(0, nodes.indexOf(a)), a);
    });
    return { open };
  })();

  /* 9. Lecteur vidéo en dialog ---------------------------------------------------
     <button data-video="film.mp4" data-video-poster="poster.jpg" data-video-title="Titre">
     La vidéo n'est demandée qu'au clic ; elle est déchargée à la fermeture. */
  SD.video = (() => {
    let dlg, vid, title, opener = null;
    const build = () => {
      dlg = document.createElement('dialog');
      dlg.className = 'vdialog';
      dlg.setAttribute('aria-label', 'Lecteur vidéo');
      dlg.innerHTML = `
        <div class="vd__top">
          <p class="vd__title"></p>
          <button class="btn-round btn-round--sm" type="button" data-vd-close aria-label="Fermer la vidéo">${SD.icon('i-close')}</button>
        </div>
        <div class="vd__stage"><video controls playsinline preload="none"></video></div>`;
      document.body.appendChild(dlg);
      vid = $('video', dlg); title = $('.vd__title', dlg);
      $('[data-vd-close]', dlg).addEventListener('click', () => dlg.close());
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('vd__stage')) dlg.close(); });
      dlg.addEventListener('close', () => {
        vid.pause(); vid.removeAttribute('src'); vid.load();
        document.body.classList.remove('is-locked');
        if (opener) opener.focus();
      });
    };
    function open({ src, poster = '', title: t = '' }, from = null) {
      if (!dlg) build();
      opener = from;
      title.textContent = t;
      vid.poster = poster;
      vid.src = src;
      dlg.showModal();
      document.body.classList.add('is-locked');
      const p = vid.play();
      if (p && p.catch) p.catch(() => {});
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-video]');
      if (!b) return;
      e.preventDefault();
      open({ src: b.dataset.video, poster: b.dataset.videoPoster, title: b.dataset.videoTitle }, b);
    });
    return { open };
  })();

  /* 10. Boucles vidéo muettes [data-loop] -----------------------------------------
     <video data-loop muted loop playsinline preload="none" poster="..." data-src="..." data-src-mobile="...">
     Le mp4 n'est demandé qu'au moment de jouer : vidéo visible et diapositive active.
     (Une <source> classique marche aussi, mais le navigateur lit alors l'en-tête dès le chargement.)
     Mouvement réduit : la vidéo reste sur son image fixe. */
  function initLoops() {
    const vids = $$('video[data-loop]');
    if (!vids.length) return;
    const state = new Map();
    const sync = (v) => {
      const s = state.get(v) || {};
      const slide = v.closest('[data-slide]');
      const active = !slide || slide.classList.contains('is-active');
      if (s.visible && active && !reduced() && !document.hidden) {
        // data-src / data-src-mobile : le mp4 n'est demandé qu'au premier besoin
        if (!v.getAttribute('src') && v.dataset.src) {
          v.src = (window.matchMedia('(max-width: 767px)').matches && v.dataset.srcMobile) || v.dataset.src;
        }
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      } else if (!v.paused) v.pause();
    };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      entries.forEach((e) => { state.set(e.target, { visible: e.isIntersecting }); sync(e.target); });
    }, { threshold: 0.25 }) : null;
    vids.forEach((v) => {
      v.muted = true;
      if (io) io.observe(v); else { state.set(v, { visible: true }); sync(v); }
      const slider = v.closest('[data-slider]');
      if (slider) slider.addEventListener('sd:slide', () => sync(v));
    });
    document.addEventListener('visibilitychange', () => vids.forEach(sync));
  }

  /* 11. Filtres [data-filters] -------------------------------------------------------
     <div data-filters="#grille"> <button data-filter="*" aria-pressed="true">Tout</button>
       <button data-filter="Forums" aria-pressed="false">Forums</button> </div>
     Les éléments de #grille portent data-cat="Forums" (plusieurs valeurs séparées par |).
     Émet "sd:filter" (detail.value, detail.count) sur la grille. */
  SD.filters = (root) => {
    const grid = $(root.dataset.filters);
    if (!grid) return;
    const buttons = $$('[data-filter]', root);
    const apply = (value) => {
      let count = 0;
      $$('[data-cat]', grid).forEach((el) => {
        const show = value === '*' || el.dataset.cat.split('|').includes(value);
        el.hidden = !show;
        if (show) count++;
      });
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
      grid.dispatchEvent(new CustomEvent('sd:filter', { detail: { value, count } }));
    };
    buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter)));
  };

  /* 12. Retour en haut [data-totop] avec anneau de progression ------------------- */
  function initToTop() {
    const btn = $('[data-totop]');
    if (!btn) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      btn.style.setProperty('--p', p.toFixed(3));
      btn.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.8);
    };
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      const target = $('#top') || document.body;
      target.focus({ preventScroll: true });
    });
    window.addEventListener('scroll', rafThrottle(update), { passive: true });
    update();
  }

  /* 13. Pause d'un défilement continu (bandeau d'événements) ------------------------
     <button data-pause aria-controls="idDuBandeau" aria-pressed="false" aria-label="...">
     Bascule la classe .is-paused sur la cible (critère WCAG 2.2.2). */
  function initPause() {
    $$('[data-pause]').forEach((btn) => {
      const target = document.getElementById(btn.getAttribute('aria-controls'));
      if (!target) return;
      btn.addEventListener('click', () => {
        const paused = target.classList.toggle('is-paused');
        btn.setAttribute('aria-pressed', String(paused));
        btn.innerHTML = SD.icon(paused ? 'i-play' : 'i-pause', 'icon icon--sm');
      });
    });
  }

  /* Démarrage ------------------------------------------------------------------------ */
  function init() {
    initHeader();
    initMenu();
    initReveal();
    initCounters();
    $$('[data-slider]').forEach(initSlider);
    $$('[data-carousel]').forEach(initCarousel);
    initWords();
    initLoops();
    $$('[data-filters]').forEach(SD.filters);
    initToTop();
    initPause();
    // Liens WhatsApp déclaratifs : <a data-wa="Message pré-rempli">
    $$('a[data-wa]').forEach((a) => { a.href = SD.wa(a.dataset.wa); a.target = '_blank'; a.rel = 'noopener'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
