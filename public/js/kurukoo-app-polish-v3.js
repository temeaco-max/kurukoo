(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  const canonical = new Map([
    ['/discover', '/app/discover'], ['/daily-picks', '/app/discover#today'], ['/requests', '/app/requests'],
    ['/tasks', '/app/tasks'], ['/connect', '/app/connect'], ['/cart', '/app/cart'], ['/wallet', '/app/wallet'],
    ['/points', '/app/points'], ['/top-up', '/app/top-up'], ['/subscription', '/app/subscriptions'],
    ['/memory', '/app/memory'], ['/safety', '/app/safety'], ['/call', '/app/call'], ['/confirmation', '/app/confirmations']
  ]);
  const section = () => window.location.pathname.match(/^\/app\/([^/?#]+)/)?.[1] || 'agent';
  const injectStyle = () => {
    if (document.querySelector('link[data-kurukoo-polish-v3]')) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/css/kurukoo-app-polish.css?v=1'; link.dataset.kurukooPolishV3 = '';
    document.head.appendChild(link);
    const extra = document.createElement('link'); extra.rel = 'stylesheet'; extra.href = '/css/kurukoo-app-polish-v2.css?v=1'; extra.dataset.kurukooPolishV3 = 'extra'; document.head.appendChild(extra);
  };
  const normalizeLinks = () => document.querySelectorAll('.k-app-main a[href],.k-app-header a[href]').forEach((anchor) => {
    const raw = anchor.getAttribute('href'); if (!raw || raw.startsWith('#') || raw.startsWith('http') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
    const [base, hash] = raw.split('#'); const replacement = canonical.get(base); if (!replacement) return; if (raw === base) anchor.setAttribute('href', replacement); else if (!base.startsWith('/app/')) anchor.setAttribute('href', replacement + (hash ? `#${hash}` : ''));
  });
  const activeNav = () => {
    const current = window.location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('.k-app-nav a,.k-mobile-tabbar a').forEach((link) => {
      let href; try { href = new URL(link.href, location.origin).pathname.replace(/\/+$/, '') || '/'; } catch { return; }
      const selected = href === current; link.classList.toggle('active', selected); if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  };
  const accountShortcut = () => {
    const header = document.querySelector('.k-app-header-actions'); const identity = header?.querySelector('.k-app-identity');
    if (!header || !identity || header.querySelector('[data-kurukoo-profile-link]')) return;
    const link = document.createElement('a'); link.href = '/settings'; link.className = 'k-app-profile-link'; link.dataset.kurukooProfileLink = '';
    link.textContent = 'Account'; link.setAttribute('aria-label','Open account settings'); header.insertBefore(link, identity);
  };
  const status = () => {
    const row = document.querySelector('.k-app-status-row'); if (!row || row.dataset.kPolished === '1') return; const chips = [...row.querySelectorAll('.k-status')];
    if (chips[0]) chips[0].textContent = 'Core Kurukoo online';
    if (chips[1]) chips[1].textContent = `Web surfaces · ${chips[1].textContent?.match(/\d+/)?.[0] || '—'}`;
    if (chips[2]) { const m = chips[2].textContent?.match(/(\d+)\/(\d+)/); chips[2].textContent = m ? `Connections active · ${m[1]}/${m[2]}` : 'Connections'; }
    row.dataset.kPolished = '1';
  };
  const discoverShortcuts = () => {
    if (section() !== 'discover' || document.querySelector('[data-discover-quick-actions]')) return;
    const title = document.querySelector('.k-app-title-row'); if (!title) return;
    const nav = document.createElement('nav'); nav.className = 'k-app-quick-actions'; nav.dataset.discoverQuickActions = ''; nav.setAttribute('aria-label','Discover shortcuts');
    [['Today','#today'],['Nearby','#nearby'],['Topics','/app/topics'],['Opportunities','/app/opportunities'],['Products','#products'],['Ask Kurukoo','/chat']].forEach(([label,href],i)=>{const a=document.createElement('a');a.href=href;a.className=`k-app-quick-action${i===5?' primary':''}`;a.textContent=label;nav.appendChild(a)});
    title.insertAdjacentElement('afterend',nav);
  };
  const run = () => { injectStyle(); normalizeLinks(); activeNav(); accountShortcut(); status(); discoverShortcuts(); };
  const boot = () => { run(); requestAnimationFrame(run); setTimeout(run, 120); const main=document.querySelector('.k-app-main'); if(main){const observer=new MutationObserver(()=>requestAnimationFrame(run)); observer.observe(main,{childList:true,subtree:true}); setTimeout(()=>observer.disconnect(),3000);} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();