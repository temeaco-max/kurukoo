(() => {
  'use strict';
  const list = document.getElementById('home-guides-list');
  if (!list) return;

  function message(value) {
    const item = document.createElement('p');
    item.className = 'muted-info-text';
    item.textContent = value;
    list.replaceChildren(item);
  }

  function updatedLabel(value) {
    if (!value) return 'Published guidance';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? 'Published guidance' : `Updated ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  }

  function card(resource) {
    const link = document.createElement('a');
    link.className = 'home-guide-card';
    link.href = `/resources/${encodeURIComponent(resource.slug || '')}`;
    const category = document.createElement('span');
    category.textContent = resource.category || 'Guide';
    const title = document.createElement('h3');
    title.textContent = resource.title || 'Untitled guide';
    const excerpt = document.createElement('p');
    excerpt.textContent = resource.excerpt || 'Open this guide for the available details.';
    const meta = document.createElement('small');
    meta.textContent = updatedLabel(resource.updatedAt || resource.updated_at);
    const action = document.createElement('strong');
    action.textContent = 'Read guide →';
    link.append(category, title, excerpt, meta, action);
    return link;
  }

  (async () => {
    try {
      const response = await fetch('/api/resources', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Resource API unavailable');
      const payload = await response.json();
      const resources = Array.isArray(payload.resources) ? payload.resources.filter((resource) => resource?.slug).slice(0, 3) : [];
      if (!resources.length) return message('Guides are being prepared. Browse Resources for current public guidance.');
      list.replaceChildren(...resources.map(card));
    } catch (_) {
      message('Guides could not be loaded right now. You can still browse the Resource library.');
    }
  })();
})();
