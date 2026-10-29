/* ==========================================================================
   SowDigital · Maquette D · page Photos
   Chargé après app.js : <script src="../assets/photos.js" defer></script>

   1. Héros : compteur « 03 / 12 », légende de la photo, chargement des voisines
   2. Données : assets/photos.json (649 photos, 34 reportages)
   3. Mosaïque : rubriques, filtre « reportage » (?projet=), pagination par 48
   4. Visionneuse : tout le jeu filtré, image taillée pour l'écran,
      le focus revient sur la tuile de la dernière photo vue
   Les 48 premières tuiles sont déjà dans le HTML : la page marche sans JS.
   ========================================================================== */
(() => {
  'use strict';

  const SD = window.SD || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = () => (SD.reduced ? SD.reduced() : window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const icon = (id, cls) => (SD.icon ? SD.icon(id, cls) : '');
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = new Intl.NumberFormat('fr-FR');
  const plural = (n, one, many) => `${fmt.format(n)} ${n > 1 ? many : one}`;

  /* 1. Héros ------------------------------------------------------------------ */
  function initHero() {
    const hero = $('.ph-hero');
    if (!hero) return;
    const slides = $$('[data-slide]', hero);
    const cur = $('[data-slider-current]', hero);
    const tot = $('[data-slider-total]', hero);
    const cap = $('[data-ph-hcap]', hero);
    const capTitle = $('[data-ph-hcap-title]', hero);
    const capMeta = $('[data-ph-hcap-meta]', hero);
    if (tot) tot.textContent = pad(slides.length);

    // Les diapositives cachées n'ont que data-src : on ne charge que la photo montrée et ses voisines
    const hydrate = (slide) => {
      if (!slide || slide.dataset.hydrated) return;
      slide.dataset.hydrated = '1';
      $$('[data-srcset]', slide).forEach((el) => { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); });
      $$('img[data-src]', slide).forEach((el) => { el.src = el.dataset.src; el.removeAttribute('data-src'); });
    };
    const neighbours = (i) => {
      hydrate(slides[(i + 1) % slides.length]);
      hydrate(slides[(i - 1 + slides.length) % slides.length]);
    };

    const onSlide = (i) => {
      const s = slides[i];
      hydrate(s);
      if (cur) cur.textContent = pad(i + 1);
      if (cap) {
        const swap = () => {
          capTitle.textContent = s.dataset.capTitle || '';
          capMeta.textContent = s.dataset.capMeta || '';
          cap.setAttribute('href', s.dataset.capHref || '#galerie');
          cap.classList.remove('is-swapping');
        };
        if (reduced()) swap();
        else { cap.classList.add('is-swapping'); setTimeout(swap, 180); }
      }
      neighbours(i);
    };
    hero.addEventListener('sd:slide', (e) => onSlide(e.detail.index));

    // app.js a déjà affiché la première diapositive : on synchronise sans attendre
    const start = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
    if (cur) cur.textContent = pad(start + 1);
    // Après le chargement : seulement la suivante (priorité à la première photo).
    // La précédente se charge dès qu'on vise le bouton « précédent ».
    const later = () => (window.requestIdleCallback ? requestIdleCallback(() => hydrate(slides[start + 1]), { timeout: 2000 }) : setTimeout(() => hydrate(slides[start + 1]), 600));
    const prevBtn = $('[data-slider-prev]', hero);
    const prevIntent = () => hydrate(slides[(start - 1 + slides.length) % slides.length]);
    if (prevBtn) ['pointerenter', 'focus', 'touchstart'].forEach((t) => prevBtn.addEventListener(t, prevIntent, { once: true, passive: true }));
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
  }

  /* 2-4. Mosaïque ----------------------------------------------------------- */
  function initGallery() {
    const grid = $('#grille');
    if (!grid) return;
    const PER = +(grid.dataset.perPage || 48);
    const bar = $('[data-ph-bar]');
    const filterWrap = $('[data-ph-filters]');
    const buttons = $$('[data-ph-filter]');
    const projectBox = $('[data-ph-project]');
    const projectTitle = $('[data-ph-project-title]');
    const projectClear = $('[data-ph-project-clear]');
    const status = $('[data-ph-status]');
    const moreBtn = $('[data-ph-more]');
    const leftEl = $('[data-ph-left]');
    const endEl = $('[data-ph-end]');
    const progress = $('[data-ph-progress]');

    // Fondu à l'arrivée de chaque image (la tuile vide pulse doucement en attendant).
    // La classe is-live n'est posée qu'ici : sans ce script, les images s'affichent normalement.
    const markLoaded = (img) => img.classList.add('is-loaded');
    grid.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') markLoaded(e.target); }, true);
    grid.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') markLoaded(e.target); }, true);
    $$('img', grid).forEach((img) => { if (img.complete) markLoaded(img); });
    grid.classList.add('is-live');

    let all = null; // toutes les photos, ordre de mosaique_photos (déjà mélangé entre reportages)
    let list = null; // jeu filtré
    let shown = $$('li', grid).length || PER;
    const state = { rub: '*', projet: null };

    const ready = fetch(grid.dataset.src)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((j) => {
        const projets = j.projets.map(([slug, titre, rubrique, date, lieu]) => ({ slug, titre, rubrique, date, lieu }));
        all = j.photos.map(([uid, w, h, alt, caption, pi, t], i) => ({ i, uid, w, h, alt, caption, p: projets[pi], pre: j.pre[t], base: j.base }));
        list = all;
        return all;
      });
    ready.catch(() => { /* sans données : les 48 tuiles du HTML et leurs liens restent utilisables */ });

    const url = (ph, trans) => `${ph.base}${ph.pre}f_auto,q_auto,${trans}/sowdigital/${ph.uid}`;
    const place = (p) => (p.lieu && !p.titre.toLowerCase().includes(p.lieu.toLowerCase()) ? p.lieu : '');
    const meta = (ph) => [ph.p.titre, place(ph.p), ph.p.date].filter(Boolean).join(' · ');

    // Même gabarit que les tuiles générées dans le HTML (mêmes URL, donc même cache)
    const TILE_W = [400, 640, 960];
    const SIZES = '(min-width: 1100px) 25vw, (min-width: 700px) 34vw, 50vw';
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function tile(ph, index) {
      const side = Math.min(ph.w, ph.h);
      const ws = TILE_W.filter((w) => w <= side);
      if (!ws.length) ws.push(side);
      const srcset = ws.map((w) => `${url(ph, `c_fill,g_auto,ar_1,w_${w}`)} ${w}w`).join(', ');
      const src = url(ph, `c_fill,g_auto,ar_1,w_${ws[Math.min(1, ws.length - 1)]}`);
      const li = document.createElement('li');
      li.innerHTML = `<a class="mosaic__item ph-item" href="${esc(url(ph, `c_limit,w_${Math.min(1600, ph.w)}`))}" data-index="${index}">`
        + `<img src="${esc(src)}" srcset="${esc(srcset)}" sizes="${SIZES}" width="600" height="600" loading="lazy" decoding="async" alt="${esc(ph.alt)}">`
        + '<span class="mosaic__shade" aria-hidden="true"></span>'
        + `<span class="mosaic__cap ph-cap"><span class="ph-cap__rub">${esc(ph.p.rubrique)}</span><span class="ph-cap__title">${esc(ph.p.titre)}</span></span>`
        + `<span class="ph-item__zoom" aria-hidden="true">${icon('i-expand', 'icon icon--sm')}</span></a>`;
      return li;
    }

    // Ajoute les tuiles [from, to) avec une entrée en fondu échelonnée
    function append(from, to) {
      const frag = document.createDocumentFragment();
      for (let k = from; k < to; k++) {
        const li = tile(list[k], k);
        if (!reduced()) { li.classList.add('is-new'); li.style.setProperty('--k', `${Math.min(k - from, 24) * 14}ms`); }
        frag.appendChild(li);
      }
      grid.appendChild(frag);
    }

    // Dernière rangée incomplète (ex. 11 photos sur 4 colonnes) : une case « devis » la complète
    let fillCols = 0;
    function fillEnd() {
      const old = $('.ph-fill', grid);
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const rem = list ? list.length % cols : 0;
      const need = list && shown >= list.length && rem > 0;
      if (old && (!need || fillCols !== cols)) old.remove();
      fillCols = cols;
      if (!need || $('.ph-fill', grid)) return;
      const li = document.createElement('li');
      li.className = 'ph-fill';
      li.style.gridColumn = `span ${cols - rem}`;
      li.innerHTML = '<a href="#devis"><span class="label">Votre événement</span><strong>Racontons votre prochain événement.</strong>'
        + `<span class="link-arrow">Demander un devis${icon('i-arrow')}</span></a>`;
      grid.appendChild(li);
    }
    let rz = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(fillEnd); });

    function updateUI() {
      fillEnd();
      const total = list ? list.length : +($('[data-ph-total]').textContent.replace(/\D/g, '') || 0);
      const n = Math.min(shown, total);
      $$('[data-ph-shown]').forEach((el) => { el.textContent = fmt.format(n); });
      $$('[data-ph-total]').forEach((el) => { el.textContent = fmt.format(total); });
      const left = total - n;
      moreBtn.hidden = left <= 0;
      endEl.hidden = left > 0 || total <= PER;
      if (leftEl) leftEl.textContent = left > 1 ? `${fmt.format(left)} restantes` : `${left} restante`;
      if (progress) progress.style.setProperty('--p', total ? (n / total).toFixed(3) : '1');
    }

    function filterList() {
      if (state.projet) return all.filter((ph) => ph.p.slug === state.projet);
      if (state.rub === '*') return all;
      return all.filter((ph) => ph.p.rubrique === state.rub);
    }

    function syncButtons() {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(!state.projet && b.dataset.phFilter === state.rub)));
      if (state.projet && list.length) {
        projectTitle.textContent = `${list[0].p.titre} · ${plural(list.length, 'photo', 'photos')}`;
        projectBox.hidden = false;
      } else projectBox.hidden = true;
    }

    function syncURL() {
      const u = new URL(location.href);
      u.searchParams.delete('projet'); u.searchParams.delete('rubrique');
      if (state.projet) u.searchParams.set('projet', state.projet);
      else if (state.rub !== '*') u.searchParams.set('rubrique', state.rub);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }

    // Ramène le début de la mosaïque sous la barre si on l'a dépassé
    function scrollToGrid(force) {
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 80;
      const top = grid.getBoundingClientRect().top + window.scrollY - headerH - (bar ? bar.offsetHeight : 0) + 1;
      if (force || window.scrollY > top + 4) window.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' });
    }

    // Filtrer : instantané, pagination remise à 48, le focus reste sur le bouton
    function apply({ rub = '*', projet = null } = {}, opts = {}) {
      state.rub = rub; state.projet = projet;
      list = filterList();
      if (projet && !list.length) { state.projet = null; list = filterList(); }
      shown = Math.min(PER, list.length);
      grid.replaceChildren();
      append(0, shown);
      syncButtons();
      updateUI();
      if (!opts.silent) syncURL();
      const label = state.projet ? `Reportage ${list[0].p.titre}` : (state.rub === '*' ? 'Toutes les rubriques' : state.rub);
      status.textContent = `${label} : ${plural(list.length, 'photo', 'photos')}, ${fmt.format(shown)} affichées.`;
      if (opts.scroll) scrollToGrid(opts.scroll === 'force');
      revealActiveButton();
    }

    // Petits écrans : le bouton actif reste visible dans la rangée qui défile
    function revealActiveButton() {
      const b = buttons.find((x) => x.getAttribute('aria-pressed') === 'true');
      if (!b || filterWrap.scrollWidth <= filterWrap.clientWidth) return;
      const r = b.getBoundingClientRect(), w = filterWrap.getBoundingClientRect();
      if (r.left < w.left || r.right > w.right - 40) filterWrap.scrollBy({ left: r.left - w.left - 24, behavior: reduced() ? 'auto' : 'smooth' });
    }
    const edge = () => {
      filterWrap.classList.toggle('is-start', filterWrap.scrollLeft <= 4);
      filterWrap.classList.toggle('is-end', filterWrap.scrollLeft + filterWrap.clientWidth >= filterWrap.scrollWidth - 4);
    };
    filterWrap.addEventListener('scroll', edge, { passive: true });
    window.addEventListener('resize', edge);
    edge();

    buttons.forEach((b) => b.addEventListener('click', async () => {
      await ready;
      apply({ rub: b.dataset.phFilter }, { scroll: true });
    }));

    projectClear.addEventListener('click', async () => {
      await ready;
      apply({ rub: '*' }, { scroll: true });
      buttons[0].focus(); // le bouton retiré disparaît : le focus va sur « Tout »
    });

    // Voir plus : 48 de plus, le focus passe sur la première nouvelle photo
    moreBtn.addEventListener('click', async () => {
      await ready;
      const from = shown;
      shown = Math.min(list.length, shown + PER);
      append(from, shown);
      updateUI();
      status.textContent = `${fmt.format(shown - from)} photos ajoutées, ${fmt.format(shown)} sur ${fmt.format(list.length)}.`;
      const first = $(`[data-index="${from}"]`, grid);
      if (first) first.focus({ preventScroll: true });
    });

    // Visionneuse : image c_limit taillée pour l'écran (paliers pour profiter du cache)
    const STEPS = [640, 960, 1280, 1600, 1920, 2560];
    function lbItem(ph) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const mobile = vw <= 767;
      const boxW = mobile ? vw : vw * 0.86;
      const boxH = mobile ? vh - 250 : vh - 176;
      const need = Math.min(boxW, Math.max(200, boxH) * ph.w / ph.h) * Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.min(ph.w, STEPS.find((s) => s >= need) || STEPS[STEPS.length - 1]);
      return { src: url(ph, `c_limit,w_${w}`), srcset: '', alt: ph.alt, caption: ph.caption, meta: meta(ph) };
    }

    let lbDialog = null;
    function hookLightboxClose() {
      if (lbDialog) return;
      lbDialog = $('dialog.lightbox');
      if (!lbDialog) return;
      // app.js rend le focus à la tuile cliquée ; on le pose plutôt sur la dernière photo vue.
      // Si elle est juste après les tuiles affichées, on ouvre la page suivante ;
      // plus loin (retour par la fin de la série), le focus reste sur la tuile cliquée.
      lbDialog.addEventListener('close', () => {
        const b = $('.lb__count b', lbDialog);
        const n = b ? parseInt(b.textContent, 10) - 1 : NaN;
        if (Number.isNaN(n) || !list || n >= list.length || n >= shown + PER) return;
        if (n >= shown) {
          const from = shown;
          shown = Math.min(list.length, shown + PER);
          append(from, shown);
          updateUI();
        }
        const t = $(`[data-index="${n}"]`, grid);
        if (t) t.focus();
      });
    }

    grid.addEventListener('click', async (e) => {
      const a = e.target.closest('.ph-item');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0 || !SD.lightbox) return;
      e.preventDefault();
      try { await ready; } catch (err) { window.location.href = a.href; return; }
      SD.lightbox.open(list.map(lbItem), +a.dataset.index, a);
      hookLightboxClose();
    });

    // Liens ?projet=… de la page (légende du héros, pied de page) : filtrage sur place
    document.addEventListener('click', async (e) => {
      const a = e.target.closest('a[href^="?projet="]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      await ready;
      apply({ projet: new URLSearchParams(a.getAttribute('href').slice(1)).get('projet') }, { scroll: 'force' });
      projectClear.focus({ preventScroll: true });
    });

    // Arrivée avec ?projet=… (cartes de l'accueil) ou ?rubrique=…
    const params = new URLSearchParams(location.search);
    const p0 = params.get('projet'), r0 = params.get('rubrique');
    if (p0 || (r0 && buttons.some((b) => b.dataset.phFilter === r0))) {
      ready.then(() => {
        apply(p0 ? { projet: p0 } : { rub: r0 }, { silent: true });
        if (p0 && !location.hash) requestAnimationFrame(() => scrollToGrid('force'));
      });
    } else {
      ready.then(updateUI);
    }
  }

  function init() { initHero(); initGallery(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
