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
        nav.setAttribute('aria-expanded', 'false');
        nav.setAttribute('aria-label', 'Open navigation');
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
  const loadMore = document.querySelector('#load-more-projects');
  if (!grid || !search || !cat || !lang || !sort) return;

  const initialCards = [...grid.querySelectorAll('.card')];
  const initialLimit = 12;
  let cards = initialCards;
  let expanded = false;
  let loaded = false;
  let loading = null;

  const tierLabel = tier => tier === 'flagship' ? 'Flagship' : tier === 'experimental' ? 'Experimental' : tier === 'active' ? 'Active' : 'Archive';
  const createCard = (project, index) => {
    const article = document.createElement('article');
    article.className = 'card';
    article.dataset.category = project.category || '';
    article.dataset.language = project.language || '';
    article.dataset.name = String(project.name || '').toLowerCase();
    article.dataset.updated = Date.parse(project.pushed_at || '') || 0;
    article.dataset.stars = project.stars || 0;
    const tags = document.createElement('div');
    tags.className = 'tags';
    const statusTag = document.createElement('span');
    statusTag.textContent = project.status || tierLabel(project.tier).toLowerCase();
    tags.appendChild(statusTag);
    const content = document.createElement('div');
    const small = document.createElement('small');
    small.textContent = `${tierLabel(project.tier)} · ${project.category || 'Uncategorized'} · ${project.language || 'Unknown'}`;
    const heading = document.createElement('h3');
    heading.textContent = project.name;
    const description = document.createElement('p');
    description.textContent = project.description || 'Not documented in the repository.';
    const link = document.createElement('a');
    link.className = 'text-link';
    link.href = `/SYJ-Labs/projects/${project.slug}/`;
    link.textContent = 'View project →';
    content.append(small, heading, description, tags, link);
    article.appendChild(content);
    return article;
  };

  async function ensureLoaded() {
    if (loaded) return cards;
    if (loading) return loading;
    loading = fetch('/SYJ-Labs/data/projects.json', { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Catalogue data request failed: ${response.status}`);
        return response.json();
      })
      .then(data => {
        const publicProjects = (data.projects || []).filter(project => project.include !== false && project.tier !== 'archive');
        const existing = new Set(cards.map(card => card.dataset.name));
        publicProjects.forEach((project, index) => {
          if (existing.has(String(project.name || '').toLowerCase())) return;
          const card = createCard(project, index);
          card.hidden = true;
          grid.appendChild(card);
        });
        cards = [...grid.querySelectorAll('.card')];
        loaded = true;
        return cards;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  async function apply() {
    const q = search.value.trim().toLowerCase();
    const category = cat.value;
    const language = lang.value;
    const filtering = Boolean(q || category || language);

    if (filtering || expanded) await ensureLoaded();

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

    if (loadMore) loadMore.hidden = filtering || expanded || matching.length <= initialLimit;
    if (status) {
      status.textContent = filtering
        ? `${matching.length} matching project${matching.length === 1 ? '' : 's'}`
        : `${matching.length} project${matching.length === 1 ? '' : 's'} · showing ${display.length}`;
    }
  }

  if (loadMore) {
    loadMore.addEventListener('click', async () => {
      expanded = true;
      await apply();
      loadMore.hidden = true;
    });
  }

  [search, cat, lang, sort].forEach(el => {
    el.addEventListener('input', async () => {
      expanded = false;
      if (loadMore) loadMore.hidden = false;
      await apply();
    });
    el.addEventListener('change', async () => {
      expanded = false;
      if (loadMore) loadMore.hidden = false;
      await apply();
    });
  });

  apply();
})();
