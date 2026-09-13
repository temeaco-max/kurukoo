(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  const install = () => {
    const trigger = document.querySelector('[aria-controls="kurukoo-drawer-profile"]');
    if (!trigger || trigger.dataset.accountMenuEnhanced === 'true') return;
    trigger.dataset.accountMenuEnhanced = 'true';
    trigger.addEventListener('click', () => {
      setTimeout(() => {
        const drawer = document.getElementById('kurukoo-drawer-profile');
        const body = drawer?.querySelector('.k-desk-drawer-body');
        if (!drawer || !body || drawer.hidden) return;
        const identityNode = document.querySelector('.k-app-identity');
        const name = identityNode?.querySelector('strong')?.textContent?.trim() || 'Your account';
        const phone = identityNode?.querySelector('small')?.textContent?.trim() || '';
        body.innerHTML = `
          <div class="k-account-menu-identity">
            <div class="k-desk-avatar">${name.slice(0, 1).toUpperCase()}</div>
            <div><strong>${name}</strong><span>${phone}</span></div>
          </div>
          <div class="k-account-menu-group"><span class="k-account-menu-label">Account</span>
            <a class="k-desk-drawer-link" href="/settings#profile">Profile</a>
            <a class="k-desk-drawer-link" href="/settings">Settings</a>
          </div>
          <div class="k-account-menu-group"><span class="k-account-menu-label">Connections</span>
            <a class="k-desk-drawer-link" href="/connect">Connect</a>
            <a class="k-desk-drawer-link" href="/settings#contacts">Contacts</a>
          </div>
          <div class="k-account-menu-group"><span class="k-account-menu-label">Personal</span>
            <a class="k-desk-drawer-link" href="/saved">Saved</a>
            <a class="k-desk-drawer-link" href="/settings#appearance">Appearance</a>
            <a class="k-desk-drawer-link" href="/settings#memory">Memory</a>
            <a class="k-desk-drawer-link" href="/settings#safety">Safety & check-ins</a>
          </div>
          <div class="k-account-menu-group"><span class="k-account-menu-label">Money & plans</span>
            <a class="k-desk-drawer-link" href="/subscriptions">Subscriptions</a>
            <a class="k-desk-drawer-link" href="/wallet">Wallet</a>
            <a class="k-desk-drawer-link" href="/top-up">Top up</a>
          </div>
          <div class="k-account-menu-group"><span class="k-account-menu-label">Intelligence</span>
            <a class="k-desk-drawer-link" href="/agents">AI Agents</a>
            <a class="k-desk-drawer-link" href="/chat">Agent</a>
          </div>
          <a class="k-desk-drawer-link is-danger" href="/api/auth/logout">Sign out</a>
        `;
      }, 0);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  new MutationObserver(install).observe(document.body, { childList: true, subtree: true });
})();
