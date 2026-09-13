(() => {
  'use strict';
  const bootstrap = async () => {
    const isAuthenticatedSurface = document.body?.classList.contains('k-app-page') || document.body?.classList.contains('workspace-page');
    if (!isAuthenticatedSurface || document.querySelector('[data-kurukoo-auth-left-rail-ad]')) return;

    const rail = document.querySelector('.k-app-sidebar') || document.querySelector('.workspace-sidebar');
    if (!rail) return;

    try {
      const response = await fetch('/api/advertising/left-rail', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (response.status === 401 || !response.ok) return;
      const payload = await response.json();
      const campaign = Array.isArray(payload?.campaigns) ? payload.campaigns[0] : null;
      if (!campaign) return;

      const card = document.createElement('aside');
      card.className = 'kos-auth-left-rail-ad';
      card.dataset.kurukooAuthLeftRailAd = 'true';
      const media = document.createElement('div');
      media.className = 'kos-auth-left-rail-ad-media';
      const image = document.createElement('img');
      image.src = String(campaign.image || '');
      image.alt = String(campaign.title || 'Sponsored');
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      const copy = document.createElement('div');
      copy.className = 'kos-auth-left-rail-ad-copy';
      const title = document.createElement('strong');
      title.textContent = String(campaign.title || 'Sponsored');
      const desc = document.createElement('p');
      desc.textContent = String(campaign.desc || '');
      copy.append(title, desc);
      media.append(image, copy);
      const action = document.createElement('div');
      action.className = 'kos-auth-left-rail-ad-action';
      const disclosure = document.createElement('span');
      disclosure.className = 'kos-sponsor-disclosure';
      disclosure.textContent = String(campaign.disclosure || 'Sponsored');
      const link = document.createElement('a');
      link.href = String(campaign.clickUrl || campaign.destination || '/advertise');
      link.textContent = String(campaign.ctaText || 'Learn more');
      link.setAttribute('aria-label', `${link.textContent}: ${title.textContent}`);
      action.append(disclosure, link);
      card.append(media, action);

      const account = rail.querySelector('.workspace-account') || rail.querySelector('.k-app-account');
      if (account) rail.insertBefore(card, account);
      else rail.appendChild(card);
    } catch {
      // Advertising is optional. Never let an unavailable campaign affect shell rendering.
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true }); else bootstrap();
})();
