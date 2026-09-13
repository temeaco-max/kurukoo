(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  const install = () => {
    const trigger = document.querySelector('[aria-controls="kurukoo-drawer-workspace"]');
    if (!trigger || trigger.dataset.authNavEnhanced === 'true') return;
    trigger.dataset.authNavEnhanced = 'true';
    trigger.setAttribute('aria-label', 'More');
    trigger.setAttribute('title', 'More');
    const observer = new MutationObserver(() => {
      const drawer = document.getElementById('kurukoo-drawer-workspace');
      const body = drawer?.querySelector('.k-desk-drawer-body');
      if (!drawer || !body || drawer.hidden || body.dataset.authNavReframed === 'true') return;
      body.dataset.authNavReframed = 'true';
      const safe = (value) => String(value).replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' })[char]);
      body.innerHTML = `
        <p class="k-muted">Secondary work and quick-return surfaces stay close without crowding the primary navigation.</p>
        <section class="k-desk-workspace-group">
          <h3>Recent conversations</h3>
          <a class="k-desk-drawer-link" href="/chat">Open Agent conversations</a>
          <a class="k-desk-drawer-link" href="/chat">New conversation</a>
        </section>
        <section class="k-desk-workspace-group">
          <h3>Secondary work</h3>
          <a class="k-desk-drawer-link" href="/reminders">Reminders</a>
          <a class="k-desk-drawer-link" href="/topics">Topics</a>
        </section>
        <div class="k-desk-context-note">
          <strong>Everything else has a better home</strong>
          <span>Account, connections, money, AI Agents, privacy, memory, safety and appearance live in Account or Settings.</span>
        </div>
      `;
      const title = drawer.querySelector('.k-desk-drawer-head h2');
      if (title) title.textContent = 'More';
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
