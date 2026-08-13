(() => {
  'use strict';
  const body = document.getElementById('article-body');
  const slug = body?.dataset.resourceSlug;
  if (!body || !slug) return;

  function appendTextBlock(target, tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    target.append(element);
    return element;
  }

  function renderBody(target, value) {
    let list = null;
    String(value || '').split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line) { list = null; return; }
      if (/^###\s+/.test(line)) { appendTextBlock(target, 'h3', line.replace(/^###\s+/, '')); list = null; return; }
      if (/^##\s+/.test(line)) { appendTextBlock(target, 'h2', line.replace(/^##\s+/, '')); list = null; return; }
      if (/^#\s+/.test(line)) { appendTextBlock(target, 'h1', line.replace(/^#\s+/, '')); list = null; return; }
      if (/^-\s+/.test(line)) {
        if (!list) { list = document.createElement('ul'); target.append(list); }
        appendTextBlock(list, 'li', line.replace(/^-\s+/, ''));
        return;
      }
      appendTextBlock(target, 'p', line); list = null;
    });
  }

  function showMessage(message, withBackLink = false) {
    body.replaceChildren();
    const text = document.createElement('p'); text.className = 'muted-info-text'; text.textContent = message; body.append(text);
    if (withBackLink) { const link = document.createElement('a'); link.className = 'article-back-link'; link.href = '/resources'; link.textContent = 'Browse all resources'; body.append(link); }
  }

  (async () => {
    try {
      const response = await fetch(`/api/resources/${encodeURIComponent(slug)}`, { credentials: 'same-origin' });
      if (response.status === 404) return showMessage('Guide not found.', true);
      if (!response.ok) throw new Error('Resource unavailable');
      const resource = await response.json();
      body.replaceChildren();
      appendTextBlock(body, 'div', resource.category || 'Guide').className = 'resource-card-cat text-terracotta';
      appendTextBlock(body, 'h1', resource.title || 'Untitled guide').className = 'article-title-h1';
      if (resource.updated_at) { const meta = document.createElement('div'); meta.className = 'article-date-meta'; const date = new Date(resource.updated_at); meta.textContent = Number.isNaN(date.valueOf()) ? '' : `Updated ${date.toLocaleDateString()}`; body.append(meta); }
      const content = document.createElement('div'); content.className = 'article-body-text'; renderBody(content, resource.body || resource.excerpt || ''); body.append(content);
    } catch (_) { showMessage('Could not load this guide right now.', true); }
  })();
})();
