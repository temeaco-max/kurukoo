(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page')) return;
  if (document.documentElement.dataset.kurukooDeskSystem === 'true') return;
  document.documentElement.dataset.kurukooDeskSystem = 'true';

  let accountName = 'Your account';
  let accountPhone = '';
  const section = document.body.dataset.appSection || '';
  const legacyToCanonical = (pathname) => {
    const direct = {
      '/app': '/desk','/app/agent': '/chat','/app/discover': '/discover','/app/requests': '/requests','/app/tasks': '/tasks','/app/connect': '/connect','/app/reminders': '/reminders','/app/saved': '/saved','/app/cart': '/cart','/app/agents': '/agents','/app/capabilities': '/capabilities','/app/opportunities': '/opportunities','/app/wallet': '/wallet','/app/points': '/points','/app/top-up': '/top-up','/app/subscriptions': '/subscriptions','/app/checkout': '/checkout','/app/confirmations': '/confirmations','/app/memory': '/memory','/app/artifacts': '/artifacts','/app/prayer': '/prayer','/app/call': '/call','/app/notifications': '/notifications','/app/safety': '/safety','/app/settings': '/settings'
    };
    if (direct[pathname]) return direct[pathname];
    if (pathname.startsWith('/app/requests/')) return pathname.replace('/app/requests/', '/requests/');
    if (pathname.startsWith('/app/tasks/')) return pathname.replace('/app/tasks/', '/tasks/');
    if (pathname.startsWith('/app/agents/')) return pathname.replace('/app/agents/', '/agents/');
    if (pathname.startsWith('/app/opportunities/')) return pathname.replace('/app/opportunities/', '/opportunities/');
    if (pathname.startsWith('/app/connections/')) return pathname.replace('/app/connections/', '/connections/');
    if (pathname.startsWith('/app/memory/')) return pathname.replace('/app/memory/', '/memory/');
    if (pathname.startsWith('/app/artifacts/')) return pathname.replace('/app/artifacts/', '/artifacts/');
    return pathname;
  };

  const normalizeLinks = () => {
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const raw = anchor.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) return;
      try {
        const url = new URL(raw, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const canonical = legacyToCanonical(url.pathname);
        if (canonical !== url.pathname) {
          url.pathname = canonical;
          anchor.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
        }
      } catch {}
    });
  };

  const closeAll = () => document.querySelectorAll('.k-desk-drawer:not([hidden])').forEach((panel) => {
    panel.hidden = true;
    document.querySelector(`[aria-controls="${panel.id}"]`)?.setAttribute('aria-expanded', 'false');
  });

  const makeDrawer = ({ id, title }) => {
    if (document.getElementById(id)) return null;
    const panel = document.createElement('aside');
    panel.className = 'k-desk-drawer'; panel.id = id; panel.hidden = true; panel.setAttribute('aria-label', title);
    panel.innerHTML = `<div class="k-desk-drawer-head"><div><span class="k-desk-drawer-kicker">Kurukoo</span><h2>${title}</h2></div><button type="button" class="k-desk-drawer-close" aria-label="Close ${title}">×</button></div><div class="k-desk-drawer-body"></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.k-desk-drawer-close')?.addEventListener('click', closeAll);
    return panel;
  };

  const buttonBase = (label, id, icon, extraClass = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `k-desk-icon-button ${extraClass}`.trim();
    button.setAttribute('aria-label', label); button.setAttribute('title', label); button.setAttribute('aria-controls', id); button.setAttribute('aria-expanded', 'false');
    button.innerHTML = `<svg class="k-app-icon" aria-hidden="true"><use href="/icons/kurukoo-icons.svg#${icon}"></use></svg>`;
    return button;
  };
  const iconButton = (label, id, icon, extraClass = '') => buttonBase(label, id, icon, extraClass);
  const searchButton = (id) => {
    const button = buttonBase('Search Kurukoo', id, 'search', 'k-desk-search-trigger');
    const label = document.createElement('span'); label.textContent = 'Search Kurukoo'; button.appendChild(label);
    return button;
  };
  const headerAction = (label, href, icon, extraClass = '') => {
    const anchor = document.createElement('a'); anchor.className = `k-desk-icon-button ${extraClass}`.trim(); anchor.href = href; anchor.setAttribute('aria-label', label); anchor.setAttribute('title', label); anchor.innerHTML = `<svg class="k-app-icon" aria-hidden="true"><use href="/icons/kurukoo-icons.svg#${icon}"></use></svg>`; return anchor;
  };

  const renderSearch = (body) => {
    body.innerHTML = '<form class="k-desk-search-form"><label for="k-desk-search-input">Search Kurukoo</label><input id="k-desk-search-input" type="search" autocomplete="off" placeholder="Search conversations, requests, tasks, people, topics…"><p class="k-desk-search-hint">Use Agent for open-ended or semantic search.</p><div class="k-desk-search-results" role="listbox"></div></form>';
    const input = body.querySelector('input'); const results = body.querySelector('.k-desk-search-results');
    const sources = [['Desk','/desk','Your workspace'],['Agent','/chat','Talk to Kurukoo'],['Discover','/discover','Find people, places, products and opportunities'],['Requests','/requests','Track active and completed requests'],['Tasks','/tasks','Manage tasks and contributions'],['Connect','/connect','Connected services and channels'],['Memory','/memory','Saved context and provenance'],['Topics','/topics','Community Topics'],['Opportunities','/opportunities','Current opportunities'],['Notifications','/notifications','Updates and actions needed'],['Settings','/settings','Account and preferences']];
    const draw = () => {
      const q = String(input.value || '').trim().toLowerCase(); results.replaceChildren();
      sources.filter(([label, href, description]) => !q || `${label} ${description}`.toLowerCase().includes(q)).forEach(([label, href, description]) => { const a=document.createElement('a'); a.className='k-desk-search-result'; a.href=href; a.innerHTML=`<strong>${label}</strong><span>${description}</span>`; results.appendChild(a); });
      if (q) { const a=document.createElement('a'); a.className='k-desk-search-result k-desk-search-result-agent'; a.href=`/chat?prompt=${encodeURIComponent(`Search Kurukoo for ${input.value.trim()}`)}`; a.innerHTML='<strong>Ask Agent</strong><span>Search semantically across Kurukoo.</span>'; results.appendChild(a); }
    };
    input.addEventListener('input', draw); input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && input.value.trim()) { event.preventDefault(); window.location.assign(`/chat?prompt=${encodeURIComponent(`Search Kurukoo for ${input.value.trim()}`)}`); } }); draw(); queueMicrotask(() => input.focus());
  };

  const renderNotifications = async (body) => {
    body.innerHTML = '<p class="k-muted">Loading notifications…</p>';
    try {
      const response = await fetch('/api/notifications', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Notifications unavailable (${response.status})`);
      const payload = await response.json(); const items = Array.isArray(payload) ? payload : Array.isArray(payload.notifications) ? payload.notifications : [];
      if (!items.length) { body.innerHTML = '<div class="k-desk-empty-state"><strong>You are up to date.</strong><p>No notifications need your attention.</p></div>'; return; }
      body.replaceChildren(); const list=document.createElement('div'); list.className='k-desk-notification-list';
      items.slice(0,30).forEach((item)=>{ const row=document.createElement('article'); row.className=`k-desk-notification${item.read||item.readAt?'':' is-unread'}`; const title=String(item.title||item.type||'Kurukoo update'); const message=String(item.body||item.message||''); const target=legacyToCanonical(String(item.link||item.href||'/notifications')); row.innerHTML=`<div><strong>${title}</strong><p>${message}</p></div><a href="${target}">${item.actionLabel||'Open'}</a>`; list.appendChild(row); });
      body.appendChild(list); const all=document.createElement('a'); all.className='k-desk-drawer-primary'; all.href='/notifications'; all.textContent='View all notifications →'; body.appendChild(all);
    } catch (error) { body.innerHTML=`<div class="k-desk-empty-state"><strong>Notifications are unavailable</strong><p>${String(error?.message||'Open Notifications for the full state.')}</p><a href="/notifications">Open Notifications →</a></div>`; }
  };

  const renderProfile = (body) => {
    body.innerHTML=`<div class="k-desk-profile-card"><div class="k-desk-avatar">${accountName.slice(0,1).toUpperCase()}</div><div><strong>${accountName}</strong><span>${accountPhone}</span></div></div>`;
    [['Settings','/settings'],['Memory','/memory'],['Notifications','/notifications'],['Open Agent','/chat']].forEach(([label,href])=>{const a=document.createElement('a');a.className='k-desk-drawer-link';a.href=href;a.textContent=label;body.appendChild(a);});
    const logout=document.createElement('a');logout.className='k-desk-drawer-link is-danger';logout.href='/api/auth/logout';logout.textContent='Sign out';body.appendChild(logout);
  };

  const renderOsWorkspace = (body) => {
    body.innerHTML = '<p class="k-muted">Your Chat workspace follows you into Desk. Nothing important from Agent is hidden here.</p>';
    const groups = [
      ['Conversation', [['New conversation','/chat'],['Recent conversations','/chat']]],
      ['Work', [['Requests','/requests'],['Tasks','/tasks'],['Discover','/discover'],['Connect','/connect'],['Topics','/topics']]],
      ['Account & continuity', [['Saved & offers','/saved'],['Reminders','/reminders'],['Memory','/memory'],['Safety & check-ins','/safety'],['Settings','/settings']]],
      ['Economy', [['Top up','/top-up'],['Subscription','/subscriptions'],['Points','/points'],['Cart','/cart']]],
    ];
    for (const [title, links] of groups) {
      const section = document.createElement('section'); section.className = 'k-desk-workspace-group';
      const heading = document.createElement('h3'); heading.textContent = title; section.appendChild(heading);
      links.forEach(([label, href]) => { const a=document.createElement('a'); a.className='k-desk-drawer-link'; a.href=href; a.textContent=label; section.appendChild(a); });
      body.appendChild(section);
    }
    const truth = document.createElement('div'); truth.className = 'k-desk-context-note'; truth.innerHTML = '<strong>Live context</strong><span>Presence, memory, connected channels and Nearby Radar belong in the contextual inspector so they do not interrupt your primary work.</span>'; body.appendChild(truth);
  };

  const renderContext = (body) => {
    body.innerHTML = '<div class="k-desk-context-stack"><section><span class="k-desk-drawer-kicker">Agent context</span><h3>Current objective</h3><p>Continue the current Kurukoo relationship from this screen without losing the originating conversation.</p><a class="k-desk-drawer-primary" href="/chat">Open Agent →</a></section><section><span class="k-desk-drawer-kicker">OS status</span><div class="k-desk-status-list"><div><span>Presence</span><strong>Owner-scoped</strong></div><div><span>Memory</span><strong>Connected to profile</strong></div><div><span>Channels</span><strong>Readiness-aware</strong></div><div><span>Nearby Radar</span><strong>Open in Discover</strong></div></div></section></div>';
  };

  const makeDeskModule = (id, label, title, body, actions = []) => {
    const article = document.createElement('article');
    article.className = `k-desk-module k-desk-module-${id}`;
    article.dataset.deskModule = id;
    const kicker = document.createElement('span'); kicker.className = 'k-desk-module-label'; kicker.textContent = label;
    const heading = document.createElement('h2'); heading.textContent = title;
    const copy = document.createElement('p'); copy.className = 'k-desk-module-copy'; copy.textContent = body;
    article.append(kicker, heading, copy);
    if (actions.length) {
      const row = document.createElement('div'); row.className = 'k-desk-module-actions';
      actions.forEach(({ label: actionLabel, href, tone = 'secondary' }) => { const a=document.createElement('a'); a.className=`k-desk-module-action ${tone === 'primary' ? 'is-primary' : ''}`.trim(); a.href=href; a.textContent=actionLabel; row.appendChild(a); });
      article.appendChild(row);
    }
    return article;
  };

  const makeDeskState = (state, title, copy, action) => {
    const stateWrap = document.createElement('div'); stateWrap.className = `k-desk-state k-desk-state-${state}`;
    const pill = document.createElement('span'); pill.className='k-desk-state-pill'; pill.textContent = state === 'unavailable' ? 'Unavailable' : state === 'empty' ? 'Nothing here yet' : state === 'ready' ? 'Ready' : state;
    const strong = document.createElement('strong'); strong.textContent = title;
    const text = document.createElement('span'); text.textContent = copy;
    stateWrap.append(pill, strong, text);
    if (action) { const link=document.createElement('a'); link.href=action.href; link.textContent=action.label; stateWrap.appendChild(link); }
    return stateWrap;
  };

  const renderDeskComposition = () => {
    if (section !== 'desk') return;
    const host = document.querySelector('.k-app-container');
    const old = host?.querySelector(':scope > section:not(.ko-context)');
    if (!host || !old || document.querySelector('[data-desk-convergence="phase1"]')) return;

    const root = document.createElement('div'); root.className='k-desk-convergence'; root.dataset.deskConvergence='phase1';
    const main = document.createElement('div'); main.className='k-desk-convergence-main';
    const rail = document.createElement('aside'); rail.className='k-desk-convergence-rail'; rail.setAttribute('aria-label','Desk context inspector');

    const welcome = makeDeskModule('welcome','Welcome',`Good to see you, ${accountName}.`,'Your Desk keeps today’s work, conversations and useful context in one place.',[{
      label:'Ask Agent',href:'/chat',tone:'primary'
    }]);
    welcome.classList.add('is-hero');
    const presence = document.createElement('div'); presence.className='k-desk-presence'; presence.dataset.agentPresence='idle';
    presence.innerHTML='<span class="k-desk-presence-dot" aria-hidden="true"></span><span><strong>Agent Presence</strong><small>Idle · ready when you are</small></span>';
    welcome.appendChild(presence);

    const today = makeDeskModule('today-flow',"Today's flow",'What matters next','Imminent work stays visible without turning Desk into a second task or reminder authority.');
    const todayList=document.createElement('div'); todayList.className='k-desk-flow-list';
    [['Review active requests','/requests'],['Check tasks and reminders','/tasks'],['Continue your latest conversation','/chat']].forEach(([label,href])=>{const row=document.createElement('a');row.className='k-desk-flow-item';row.href=href;row.innerHTML=`<span>${label}</span><strong>Open →</strong>`;todayList.appendChild(row);});
    today.appendChild(todayList);

    const continueCard = makeDeskModule('continue-conversation','Continue conversation','Pick up where you left off','Continue with the same Agent relationship and exact source context.',[{label:'Open Chat',href:'/chat',tone:'primary'}]);
    const requestCard = makeDeskModule('active-requests','Active requests','Work in motion','Request state stays owned by the canonical Economic Request lifecycle.',[{label:'View Requests',href:'/requests',tone:'primary'}]);
    requestCard.appendChild(makeDeskState('empty','No active requests are surfaced here yet','Desk does not invent provider, payment or fulfilment status.',{label:'Open Requests',href:'/requests'}));
    const taskCard = makeDeskModule('tasks-reminders','Tasks & reminders','Work to finish','Use the canonical Tasks and reminder context without creating a parallel queue.',[{label:'View Tasks',href:'/tasks',tone:'primary'}]);
    taskCard.appendChild(makeDeskState('empty','No task state is surfaced here yet','Desk preserves the task authority and continues to the source surface.',{label:'Open Tasks',href:'/tasks'}));
    const opportunityCard = makeDeskModule('opportunity-radar','Opportunity radar','Useful possibilities, clearly attributed','Relevant opportunities remain evidence-bound and continue into Discover.',[{label:'Explore Discover',href:'/discover',tone:'primary'}]);
    opportunityCard.appendChild(makeDeskState('unavailable','Live opportunity availability is deployment-dependent','No current provider or availability claim is inferred locally.'));
    const pointsCard = makeDeskModule('points','Points','Your closed-loop Points','Points remain distinct from cash settlement and external payment rails.',[{label:'Open Points',href:'/points',tone:'primary'}]);
    const pointsValue=document.createElement('div'); pointsValue.className='k-desk-points-value'; pointsValue.dataset.deskPointsValue='true'; pointsValue.textContent='Loading balance…'; pointsCard.appendChild(pointsValue);
    const topicsCard = makeDeskModule('topics-for-you','Topics for you','Community context worth exploring','Topics provide shared context and discovery signals without implying provider or transaction truth.',[{label:'Browse Topics',href:'/topics',tone:'primary'}]);
    const guideCard = makeDeskModule('guide-content','Guide content','Useful guidance, when available','Learning and resource content stays separate from live service guarantees.',[{label:'Open Help',href:'/help',tone:'primary'}]);
    const sponsorCard = makeDeskModule('sponsored-provider','Sponsored provider','Promoted visibility stays disclosed','Paid placement is shown only when sponsorship and provider evidence support it.',[{label:'Explore Discover',href:'/discover',tone:'secondary'}]);
    sponsorCard.appendChild(makeDeskState('unavailable','No sponsored placement is active in this deployment','No provider promotion is invented merely to fill the visual slot.'));
    const channelsCard = makeDeskModule('connected-channels','Connected channels','Your communication readiness','Channel connection and delivery state remain owned by Connect and external activation boundaries.',[{label:'Manage Connect',href:'/connect',tone:'primary'}]);
    channelsCard.appendChild(makeDeskState('ready','Channel readiness lives in Connect','Desk keeps this module lightweight and contextual.',{label:'Open Connect',href:'/connect'}));

    [today,continueCard,requestCard,taskCard,opportunityCard,pointsCard,topicsCard,guideCard,sponsorCard,channelsCard].forEach((card)=>main.appendChild(card));

    const pulse=makeDeskModule('pulse','Pulse','What is moving around your work','A contextual activity/timeline view belongs in the right rail.',[{label:'Open Notifications',href:'/notifications'}]);
    pulse.appendChild(makeDeskState('empty','No live pulse is surfaced in this static state','Current notifications and activities remain available from their canonical sources.'));
    const safety=makeDeskModule('safety-check-in','Safety check-in','Stay in control of safety context','Safety support is explicit, consent-bound and never represented as emergency-service delivery.',[{label:'Open Safety',href:'/safety'}]);
    safety.appendChild(makeDeskState('ready','Safety controls are available','Use the canonical Safety surface for check-ins and trusted-contact management.',{label:'Open Safety',href:'/safety'}));
    const activity=makeDeskModule('activity-summary','Activity summary','A compact view of your recent activity','Desk provides orientation; detailed analytics remain owned by the relevant surfaces.',[{label:'Open Tasks',href:'/tasks',tone:'secondary'},{label:'Open Requests',href:'/requests',tone:'secondary'}]);
    const activityMetrics = document.createElement('div'); activityMetrics.className = 'k-desk-activity-metrics'; [['Tasks', '—'], ['Requests', '—'], ['Agent goals', '—']].forEach(([label, value]) => { const item = document.createElement('div'); item.innerHTML = `<span>${label}</span><strong>${value}</strong>`; activityMetrics.appendChild(item); }); activity.appendChild(activityMetrics);
    [pulse,safety,activity].forEach((card)=>rail.appendChild(card));

    root.append(main,rail);
    old.replaceWith(root);

    fetch('/api/points/balance',{credentials:'same-origin',headers:{Accept:'application/json'}}).then((response)=>response.ok?response.json():null).then((payload)=>{
      const points=Number(payload?.points);
      document.querySelectorAll('[data-desk-points-value]').forEach((node)=>{node.textContent=Number.isFinite(points)?`${points.toLocaleString()} points`:'Points balance unavailable';});
    }).catch(()=>document.querySelectorAll('[data-desk-points-value]').forEach((node)=>{node.textContent='Points balance unavailable';}));
  };

  const wireDrawer = (panel, render) => {
    const button = panel && document.querySelector(`[aria-controls="${panel.id}"]`);
    if (!panel || !button) return;
    button.addEventListener('click', () => { if(panel.hidden){closeAll();panel.hidden=false;button.setAttribute('aria-expanded','true');render(panel.querySelector('.k-desk-drawer-body'));}else closeAll(); });
  };

  const boot = () => {
    normalizeLinks();
    const host=document.querySelector('.k-app-header-actions'); if(!host) return;
    const identity = host.querySelector('.k-app-identity');
    accountName = identity?.querySelector('strong')?.textContent?.trim() || 'Your account';
    accountPhone = identity?.querySelector('small')?.textContent?.trim() || '';
    const ask = host.querySelector('.k-app-ask');
    identity?.remove(); ask?.remove();

    const search=makeDrawer({id:'kurukoo-drawer-search',title:'Search'}); const notifications=makeDrawer({id:'kurukoo-drawer-notifications',title:'Notifications'}); const profile=makeDrawer({id:'kurukoo-drawer-profile',title:'Account'}); const workspace=makeDrawer({id:'kurukoo-drawer-workspace',title:'Your Kurukoo'}); const context=makeDrawer({id:'kurukoo-drawer-context',title:'Context'}); if(!search||!notifications||!profile||!workspace||!context) return;
    const controls = [searchButton(search.id), headerAction('Points','/points','points','k-desk-header-points'), headerAction('Cart','/cart','package','k-desk-header-cart'), iconButton('Notifications',notifications.id,'alert','k-desk-header-notifications'), iconButton('Open context inspector',context.id,'saved'), iconButton('Your Kurukoo workspace',workspace.id,'menu'), iconButton('Account',profile.id,'user','k-desk-header-account')];
    controls.forEach((control) => host.appendChild(control));
    wireDrawer(search,renderSearch); wireDrawer(notifications,renderNotifications); wireDrawer(profile,renderProfile); wireDrawer(workspace,renderOsWorkspace); wireDrawer(context,renderContext);
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape')closeAll();});
    const observer=new MutationObserver(()=>normalizeLinks()); observer.observe(document.body,{subtree:true,childList:true});
    if(!document.querySelector('link[data-kurukoo-os-components]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/css/kurukoo-os-components.css?v=1';link.dataset.kurukooOsComponents='true';document.head.appendChild(link);}
    renderDeskComposition();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
