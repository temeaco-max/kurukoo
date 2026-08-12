(() => {
  const list = document.getElementById('resources-list');
  if (!list) return;

  const setMessage = (message) => {
    list.replaceChildren();
    const item = document.createElement('div');
    item.className = 'muted-info-text';
    item.textContent = message;
    list.appendChild(item);
  };

  const renderResource = (resource) => {
    const card = document.createElement('a');
    card.href = `/resources/${encodeURIComponent(resource.slug || '')}`;
    card.className = 'resource-card-link';

    const category = document.createElement('div');
    category.className = 'resource-card-cat';
    category.textContent = resource.category || 'Guide';
    const title = document.createElement('h4');
    title.className = 'resource-card-title';
    title.textContent = resource.title || 'Untitled guide';
    const excerpt = document.createElement('p');
    excerpt.className = 'resource-card-excerpt';
    excerpt.textContent = resource.excerpt || '';
    const read = document.createElement('span');
    read.className = 'resource-read-link';
    read.textContent = 'Read guide';

    card.append(category, title, excerpt, read);
    return card;
  };

  (async () => {
    try {
      const response = await fetch('/api/resources?page=1', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Unable to load resources');
      const data = await response.json();
      const items = Array.isArray(data?.resources) ? data.resources : [];
      if (!items.length) return setMessage('More guides are being prepared.');
      list.replaceChildren(...items.map(renderResource));
    } catch (_) {
      setMessage('Could not load resources right now.');
    }
  })();
})();
