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
        nav.classList.remove('open'); menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Open navigation'); menu.focus();
      }
    });
    links.forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded','false'); }));
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); } }), {rootMargin:'0px 0px -8% 0px'});
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
  let filterTimer;
  const apply = () => {
    grid.classList.add('is-filtering');
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => grid.classList.remove('is-filtering'), 140);
    const q = search.value.trim().toLowerCase();
    const category = cat.value;
    const language = lang.value;
    const visible = cards.filter(card => {
      const match = (!q || card.dataset.name.includes(q));
      const c = !category || card.dataset.category === category;
      const l = !language || card.dataset.language === language;
      card.hidden = !(match && c && l);
      return !card.hidden;
    });
    visible.sort((a,b) => sort.value === 'name' ? a.dataset.name.localeCompare(b.dataset.name) : 0);
    visible.forEach(card => grid.appendChild(card));
    if (status) status.textContent = `${visible.length} project${visible.length === 1 ? '' : 's'}`;
  };
  [search,cat,lang,sort].forEach(el => el.addEventListener('input', apply));
  apply();
})();
