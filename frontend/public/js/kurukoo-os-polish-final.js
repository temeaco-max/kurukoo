(() => {
  const run = () => {
    if (!document.body?.classList.contains('k-app-page')) return;
    if (!document.querySelector('link[data-kurukoo-os-header]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/css/kurukoo-os-header.css?v=1'; link.dataset.kurukooOsHeader = ''; document.head.appendChild(link);
    }
    const actions = document.querySelector('.k-app-header-actions');
    const identity = actions?.querySelector('.k-app-identity');
    if (actions && identity && !actions.querySelector('[data-os-profile]')) {
      const name = identity.querySelector('strong')?.textContent?.trim() || 'Account';
      const initials = name.split(/\s+/).map(part => part[0] || '').join('').slice(0,2).toUpperCase() || 'K';
      const notify = document.createElement('a'); notify.className='os-header-notify'; notify.href='/notifications'; notify.setAttribute('aria-label','Notifications'); notify.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
      const profile = document.createElement('a'); profile.className='os-profile'; profile.href='/settings'; profile.dataset.osProfile=''; profile.setAttribute('aria-label','Open account settings'); profile.innerHTML=`<span class="os-profile-avatar">${initials}</span><span class="os-profile-copy"><strong>${escapeHtml(name)}</strong><small>Profile</small></span><span class="os-profile-chevron">⌄</span>`;
      actions.appendChild(notify); actions.appendChild(profile);
    }
    const status = actions?.querySelector('.os-header-status span:last-child');
    if (status) status.textContent = 'Kurukoo OS';
    const sponsored = [...document.querySelectorAll('.os-dashboard .os-section-title')].find(el => el.textContent?.trim() === 'Sponsored provider match');
    if (sponsored) {
      sponsored.textContent = 'Promotion slot';
      sponsored.closest('section')?.querySelector('.os-opportunity strong')?.replaceChildren(document.createTextNode('Paid visibility appears here when eligible'));
    }
    const safety = document.querySelector('.os-safety');
    if (safety) {
      const heading = safety.querySelector('h3'); if (heading) heading.textContent = 'Ready';
      const copy = safety.querySelector('p'); if (copy) copy.textContent = 'Your safety tools, check-ins and trusted-contact controls stay available here when you choose to use them.';
    }
    const activity = document.querySelector('.os-rail-card .os-activity-bars');
    if (activity && activity.dataset.staticPlaceholder !== '1') {
      activity.dataset.staticPlaceholder = '1';
      activity.querySelectorAll('.os-activity-bar').forEach(bar => bar.style.height = '12%');
      activity.parentElement?.querySelector('.os-feature-action span:first-child')?.replaceChildren(document.createTextNode('View activity'));
    }
    if (!document.querySelector('script[data-kurukoo-os-live]')) {
      const script = document.createElement('script'); script.src='/js/kurukoo-os-live-hydration.js?v=1'; script.defer=true; script.dataset.kurukooOsLive=''; document.head.appendChild(script);
    }
  };
  const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[char]));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 100), {once:true}); else setTimeout(run, 100);
})();