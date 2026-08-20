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
    const discoverCss = document.createElement('link'); discoverCss.rel = 'stylesheet'; discoverCss.href = '/css/kurukoo-app-discover.css?v=1'; discoverCss.dataset.kurukooPolishV3 = 'discover'; document.head.appendChild(discoverCss);
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
  const sanitizeProductCopy = () => {
    document.querySelectorAll('.k-app-main .k-app-card,.k-app-main .k-app-title-row').forEach((root) => {
      root.querySelectorAll('h1,h2,h3,p,span,a').forEach((el) => {
        const text = el.textContent || '';
        if (text.includes('Add Points in sandbox development.')) el.textContent = 'Add Kurukoo Points';
        else if (text.includes('Credit sandbox Points')) el.textContent = 'Add Points';
      });
    });
  };
  const discoverShortcuts = () => {
    if (section() !== 'discover' || document.querySelector('[data-discover-quick-actions]')) return;
    const title = document.querySelector('.k-app-title-row'); if (!title) return;
    const nav = document.createElement('nav'); nav.className = 'k-app-quick-actions'; nav.dataset.discoverQuickActions = ''; nav.setAttribute('aria-label','Discover shortcuts');
    [['Today','#today'],['Nearby','#nearby'],['Topics','/app/topics'],['Opportunities','/app/opportunities'],['Products','#products'],['Ask Kurukoo','/chat']].forEach(([label,href],i)=>{const a=document.createElement('a');a.href=href;a.className=`k-app-quick-action${i===5?' primary':''}`;a.textContent=label;nav.appendChild(a)});
    title.insertAdjacentElement('afterend',nav);
  };
  const getLocation = async () => {
    if (!navigator.geolocation) return null;
    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state !== 'granted') return null;
      } else return null;
      return await new Promise((resolve) => navigator.geolocation.getCurrentPosition((pos) => resolve({lat:pos.coords.latitude,lng:pos.coords.longitude}), () => resolve(null), {enableHighAccuracy:false,maximumAge:300000,timeout:5000}));
    } catch { return null; }
  };
  const requestLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((pos) => resolve({lat:pos.coords.latitude,lng:pos.coords.longitude}), () => resolve(null), {enableHighAccuracy:false,maximumAge:300000,timeout:8000});
  });
  const linkForItem = (item) => {
    const action = item?.chatAction || item?.action || {};
    const prompt = action.prompt || item?.prompt;
    if (prompt) return `/chat?prompt=${encodeURIComponent(String(prompt))}`;
    return '/app/discover';
  };
  const renderDiscoverHub = async () => {
    if (section() !== 'discover' || document.querySelector('[data-discover-hub]')) return;
    const main = document.querySelector('.k-app-main .k-app-container'); const title = main?.querySelector('.k-app-title-row'); if (!main || !title) return;
    const hub = document.createElement('section'); hub.dataset.discoverHub = ''; hub.setAttribute('aria-label','Discover content');
    hub.innerHTML = '<div class="k-app-card"><span class="k-app-card-label">Discover</span><h2>What is useful, available or happening around you?</h2><p class="k-muted">Loading your Discover feed…</p></div>';
    title.insertAdjacentElement('afterend', hub);
    try {
      const location = await getLocation();
      let payload = null;
      if (location) payload = await fetch(`/api/discover/home?lat=${encodeURIComponent(location.lat)}&lng=${encodeURIComponent(location.lng)}&radius=10000&limit=60`, {credentials:'same-origin',headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null);
      else payload = await fetch('/api/proactive/feed',{credentials:'same-origin',headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null);
      const sections = payload?.sections || {};
      const commercial = payload?.commercial || {};
      const groups = [
        ['For You', sections.for_you || commercial.products || [], 'for-you'],
        ['Today', [...(sections.today || []), ...(commercial.promotions || [])], 'today'],
        ['Nearby', location ? (sections.nearby || []) : [], 'nearby'],
        ['Topics', sections.topics || [], 'topics'],
        ['Opportunities', sections.opportunities || (payload?.opportunities || []), 'opportunities'],
        ['Products', commercial.products || [], 'products']
      ];
      const wrap = document.createElement('div'); wrap.className = 'k-app-discover-groups';
      let rendered = 0;
      for (const [label, items, id] of groups) {
        const arr = Array.isArray(items) ? items.filter(Boolean).slice(0,6) : [];
        const group = document.createElement('section'); group.className='k-app-discover-group'; group.id=id;
        const head=document.createElement('div'); head.className='k-app-discover-group-head'; head.innerHTML=`<div><span class="k-app-card-label">${label}</span><h3>${label === 'Today' ? 'Fresh and time-sensitive' : label}</h3></div>`;
        group.appendChild(head);
        if (!arr.length) {
          const empty=document.createElement('div'); empty.className='k-app-discover-empty';
          if (label === 'Nearby' && !location) {
            empty.innerHTML='<span>Local providers, places and offers appear here when you enable location.</span><button type="button" class="k-app-card-action" data-enable-location>Enable location</button>';
          } else empty.textContent = 'Nothing to show here yet. Ask Kurukoo what you need.';
          group.appendChild(empty);
        } else {
          const grid=document.createElement('div'); grid.className='k-app-grid two';
          arr.forEach((item) => { const card=document.createElement('article'); card.className='k-app-card k-app-discover-item'; const titleText=String(item.title||item.name||item.type||'Kurukoo item'); const detail=String(item.detail||item.subtitle||item.description||'').slice(0,220); const sponsored=item.sponsored===true; card.innerHTML=`<span class="k-app-card-label">${sponsored ? 'Sponsored' : label}</span><h2>${titleText}</h2><p>${detail || 'Open this in Kurukoo to see what you can do next.'}</p><a class="k-app-card-action" href="${linkForItem(item)}">${item.ctaText||item.actions?.[0]||'Open'}</a>`; grid.appendChild(card); });
          group.appendChild(grid); rendered += arr.length;
        }
        wrap.appendChild(group);
      }
      hub.replaceChildren(wrap);
      hub.querySelector('[data-enable-location]')?.addEventListener('click', async (event) => { event.currentTarget.disabled = true; const granted = await requestLocation(); if (!granted) { event.currentTarget.textContent = 'Location unavailable'; event.currentTarget.disabled = false; return; } hub.remove(); await renderDiscoverHub(); });
      if (!rendered) {
        const fallback=document.createElement('div'); fallback.className='k-app-card'; fallback.innerHTML='<span class="k-app-card-label">Explore Kurukoo</span><h2>Ask Kurukoo what you need.</h2><p>Discover becomes richer as your local network grows; the conversation remains available even when a nearby feed is sparse.</p><a class="k-app-primary" href="/chat">Ask Kurukoo</a>'; hub.appendChild(fallback);
      }
    } catch (error) {
      hub.innerHTML='<div class="k-app-card"><span class="k-app-card-label">Discover</span><h2>Discover is still available through Chat.</h2><p>We could not load the feed right now, so nothing has been invented or substituted.</p><a class="k-app-primary" href="/chat">Ask Kurukoo</a></div>';
    }
  };
  const run = () => { injectStyle(); normalizeLinks(); activeNav(); accountShortcut(); status(); sanitizeProductCopy(); discoverShortcuts(); renderDiscoverHub(); };
  const boot = () => { run(); requestAnimationFrame(run); setTimeout(run, 150); const main=document.querySelector('.k-app-main'); if(main){const observer=new MutationObserver(()=>requestAnimationFrame(run)); observer.observe(main,{childList:true,subtree:true}); setTimeout(()=>observer.disconnect(),3500);} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();