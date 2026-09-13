(() => {
  const boot = async () => {
    if (!document.body?.classList.contains('k-app-page')) return;
    if (document.querySelector('[data-kurukoo-page-architecture]')) return;
    const section = (document.body.className.match(/k-app-section-([a-z0-9-]+)/) || [])[1];
    if (!section) return;
    try {
      const response = await fetch('/data/kurukoo-page-architecture.json', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const payload = await response.json();
      const model = payload?.surfaces?.[section];
      if (!model) return;

      const container = document.querySelector('.k-app-container') || document.querySelector('.k-app-main');
      const titleRow = document.querySelector('.k-app-title-row');
      if (!container || !titleRow) return;

      const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
      const chipList = (items, className) => (Array.isArray(items) ? items : []).map(item => `<span class="k-page-architecture-chip ${className}">${escape(item)}</span>`).join('');
      const sectionRows = (Array.isArray(model.sections) ? model.sections : []).map((item, index) => `<div class="k-page-architecture-row"><span class="k-page-architecture-index">${String(index + 1).padStart(2, '0')}</span><span>${escape(item)}</span></div>`).join('');

      const panel = document.createElement('section');
      panel.dataset.kurukooPageArchitecture = 'true';
      panel.className = 'k-page-architecture';
      panel.setAttribute('aria-label', `${model.purpose} page structure`);
      panel.innerHTML = `
        <div class="k-page-architecture-head">
          <div><span class="k-page-architecture-eyebrow">Page purpose</span><h2>${escape(model.purpose)}</h2></div>
          <span class="k-page-architecture-contract">Content-complete surface</span>
        </div>
        <div class="k-page-architecture-grid">
          <div class="k-page-architecture-sections"><span class="k-page-architecture-label">Information architecture</span>${sectionRows}</div>
          <div class="k-page-architecture-side">
            <div><span class="k-page-architecture-label">User actions</span><div class="k-page-architecture-chips">${chipList(model.actions, 'action')}</div></div>
            <div><span class="k-page-architecture-label">States</span><div class="k-page-architecture-chips">${chipList(model.states, 'state')}</div></div>
          </div>
        </div>`;
      titleRow.insertAdjacentElement('afterend', panel);
    } catch {
      // Architecture panel is additive only; page functionality must remain intact if metadata is unavailable.
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void boot(); }, { once: true });
  else void boot();
})();
