(() => {
  const menu = document.querySelector('.menu');
  const nav = document.querySelector('#nav');
  if (menu && nav) {
    const links = [...nav.querySelectorAll('a')];
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      if (open) links[0]?.focus();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-label', 'Open navigation');
        menu.focus();
      }
    });
    links.forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    }));
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(x => io.observe(x));
  } else reveals.forEach(x => x.classList.add('is-visible'));

  const search = document.querySelector('#project-search');
  const cat = document.querySelector('#category-filter');
  const lang = document.querySelector('#language-filter');
  const sort = document.querySelector('#sort-projects');
  const grid = document.querySelector('#catalogue');
  const status = document.querySelector('#catalogue-status');
  if (!grid || !search || !cat || !lang || !sort) return;

  const cards = [...grid.querySelectorAll('.card')];
  const initialLimit = 12;
  const loadMore = document.querySelector('#load-more-projects');
  let expanded = false;

  if (loadMore) {
    loadMore.addEventListener('click', () => {
      expanded = true;
      apply();
      loadMore.hidden = true;
    });
  }

  function apply() {
    const q = search.value.trim().toLowerCase();
    const category = cat.value;
    const language = lang.value;
    const filtering = Boolean(q || category || language);

    const matching = cards.filter(card => {
      const match = !q || card.dataset.name.includes(q);
      const c = !category || card.dataset.category === category;
      const l = !language || card.dataset.language === language;
      return match && c && l;
    });

    matching.sort((a, b) => {
      if (sort.value === 'name') return a.dataset.name.localeCompare(b.dataset.name);
      if (sort.value === 'updated') return Number(b.dataset.updated || 0) - Number(a.dataset.updated || 0);
      return Number(b.dataset.stars || 0) - Number(a.dataset.stars || 0);
    });

    cards.forEach(card => { card.hidden = true; });
    const display = filtering || expanded ? matching : matching.slice(0, initialLimit);
    display.forEach(card => {
      card.hidden = false;
      grid.appendChild(card);
    });

    if (loadMore) {
      loadMore.hidden = filtering || expanded || matching.length <= initialLimit;
    }

    if (status) {
      status.textContent = filtering
        ? `${matching.length} matching project${matching.length === 1 ? '' : 's'}`
        : `${matching.length} project${matching.length === 1 ? '' : 's'} · showing ${display.length}`;
    }
  }

  [search, cat, lang, sort].forEach(el => {
    el.addEventListener('input', () => {
      expanded = false;
      if (loadMore) loadMore.hidden = false;
      apply();
    });
    el.addEventListener('change', () => {
      expanded = false;
      if (loadMore) loadMore.hidden = false;
      apply();
    });
  });

  apply();
})();
