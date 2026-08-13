(() => {
  'use strict';
  const strip = document.getElementById('chat-guide-strip');
  const list = document.getElementById('chat-guide-list');
  if (!strip || !list) return;

  function guideCard(resource) {
    const link = document.createElement('a');
    link.className = 'chat-guide-card';
    link.href = `/resources/${encodeURIComponent(resource.slug || '')}`;
    const category = document.createElement('span');
    category.className = 'chat-guide-card__category';
    category.textContent = resource.category || 'Guide';
    const title = document.createElement('strong');
    title.textContent = resource.title || 'Useful guide';
    const detail = document.createElement('small');
    detail.textContent = resource.excerpt || 'Open this guide for the available details.';
    link.append(category, title, detail);
    return link;
  }

  async function loadPublishedGuides() {
    try {
      const response = await fetch('/api/resources', { credentials: 'same-origin' });
      if (!response.ok) return;
      const payload = await response.json();
      const resources = Array.isArray(payload.resources) ? payload.resources.filter((item) => item?.slug).slice(0, 3) : [];
      if (!resources.length) return;
      list.replaceChildren(...resources.map(guideCard));
      strip.hidden = false;
    } catch {
      // Resource guidance is supplementary; the conversation experience remains available.
    }
  }

  loadPublishedGuides();
})();
