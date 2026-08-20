(() => {
  'use strict';
  const boot = () => {
    if (!document.body?.classList.contains('k-app-page')) return;
    const sidebar = document.querySelector('.k-app-sidebar');
    const primary = sidebar?.querySelector('.k-app-nav[aria-label="Primary"]');
    if (!sidebar || !primary || sidebar.dataset.osNavigationReady === 'true') return;
    sidebar.dataset.osNavigationReady = 'true';

    const brand = sidebar.closest('.k-app-shell')?.querySelector('.k-app-brand span');
    if (brand && !brand.querySelector('.os-brand-os')) brand.insertAdjacentHTML('beforeend', ' <em class="os-brand-os">OS</em>');

    const labels = new Map([
      ['/app/agent', 'Home'],
      ['/app/discover', 'Discover'],
      ['/app/requests', 'Requests'],
      ['/app/tasks', 'Tasks'],
    ]);
    for (const [href, label] of labels) {
      const link = primary.querySelector(`a[href="${href}"]`);
      if (link) {
        const span = link.querySelector('span:last-child');
        if (span) span.textContent = label;
      }
    }

    const ensureLink = (href, label, icon) => {
      if (primary.querySelector(`a[href="${href}"]`)) return;
      const a = document.createElement('a');
      a.href = href;
      a.innerHTML = `<svg class="k-app-icon" aria-hidden="true"><use href="/icons/kurukoo-icons.svg#${icon}"></use></svg><span>${label}</span>`;
      primary.appendChild(a);
    };
    ensureLink('/chat', 'Messages', 'chat');
    ensureLink('/app/wallet', 'Wallet', 'points');
    ensureLink('/settings', 'Profile', 'settings');

    const secondary = [...sidebar.querySelectorAll('.k-app-nav')].find((node) => node.getAttribute('aria-label') !== 'Primary');
    const account = sidebar.querySelector('.k-app-nav[aria-label="Account"]');
    const hiddenLinks = [];
    for (const group of [secondary, account]) {
      if (!group) continue;
      for (const link of group.querySelectorAll('a')) {
        hiddenLinks.push({ href: link.getAttribute('href') || '#', label: link.querySelector('span:last-child')?.textContent?.trim() || link.textContent?.trim() || 'Tool', html: link.innerHTML });
      }
      group.hidden = true;
      group.setAttribute('aria-hidden', 'true');
    }

    const divider = [...sidebar.children].find((element) => element.classList?.contains('k-app-divider'));
    const more = document.createElement('div');
    more.className = 'os-more-tools';
    more.innerHTML = '<button type="button" class="os-more-tools-trigger" aria-expanded="false"><span class="os-more-tools-icon">⊞</span><span>More tools</span><span class="os-more-tools-chevron">⌄</span></button><div class="os-more-tools-panel" hidden></div>';
    const panel = more.querySelector('.os-more-tools-panel');
    const seen = new Set();
    for (const item of hiddenLinks) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      const link = document.createElement('a');
      link.href = item.href;
      link.innerHTML = item.html;
      link.insertAdjacentHTML('beforeend', `<span class="os-more-tools-label">${escapeHtml(item.label)}</span>`);
      panel?.appendChild(link);
    }
    const compass = document.createElement('button');
    compass.type = 'button';
    compass.className = 'os-more-tools-action';
    compass.innerHTML = '<span>✦</span><span>Explore every Kurukoo capability</span>';
    compass.addEventListener('click', () => document.querySelector('.k-feature-compass-launcher')?.click());
    panel?.appendChild(compass);
    const trigger = more.querySelector('.os-more-tools-trigger');
    trigger?.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      more.classList.toggle('is-open', open);
    });
    divider?.after(more);
  };
  const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[char]));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
