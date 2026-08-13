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
    const action = document.createElement('strong');
    action.textContent = 'Read guide →';
    link.append(category, title, excerpt, action);
    return link;
  }

  (async () => {
    try {
      const response = await fetch('/api/resources', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Resource API unavailable');
      const payload = await response.json();
      const resources = Array.isArray(payload.resources) ? payload.resources.slice(0, 3) : [];
      if (!resources.length) return message('Guides are being prepared.');
      list.replaceChildren(...resources.map(card));
    } catch (_) {
      message('Guides could not be loaded right now.');
    }
  })();
})();
