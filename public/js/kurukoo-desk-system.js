(() => {
  'use strict';
  if (!document.body?.classList.contains('k-app-page') || document.body.dataset.appSection !== 'desk') return;
  if (document.documentElement.dataset.kurukooDeskSystem === 'true') return;
  document.documentElement.dataset.kurukooDeskSystem = 'true';

  let accountName = String(document.body?.dataset.displayName || 'Your account');
  let accountPhone = '';
  const greetingName = () => (/^[+\d\s().-]{7,}$/.test(accountName) ? '' : accountName);
  const section = document.body.dataset.appSection || '';
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
      items.slice(0,30).forEach((item)=>{ const row=document.createElement('article'); row.className=`k-desk-notification${item.read||item.readAt?'':' is-unread'}`; const title=String(item.title||item.type||'Kurukoo update'); const message=String(item.body||item.message||''); const target=String(item.link||item.href||'/notifications'); row.innerHTML=`<div><strong>${title}</strong><p>${message}</p></div><a href="${target}">${item.actionLabel||'Open'}</a>`; list.appendChild(row); });
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

    const friendlyName = greetingName();
    const welcome = makeDeskModule('welcome','Kurukoo Brief',friendlyName ? `Good to see you, ${friendlyName}.` : 'Good to see you.','Here is the work that needs you, what Kurukoo is moving forward, and where to continue.',[{
      label:'Ask Kurukoo',href:'/chat',tone:'primary'
    }]);
    welcome.classList.add('is-hero');
    const presence = document.createElement('div'); presence.className='k-desk-presence'; presence.dataset.agentPresence='idle';
    presence.innerHTML='<span class="k-desk-presence-dot" aria-hidden="true"></span><span><strong>Kurukoo</strong><small>Ready when you are</small></span>';
    welcome.appendChild(presence);

    const today = makeDeskModule('today-flow','Needs attention','What needs you now','Decisions, missing information, and time-sensitive follow-through appear here first.');
    const todayList=document.createElement('div'); todayList.className='k-desk-flow-list';
    [['Ask Kurukoo','/chat'],['Review requests','/requests'],['See next actions','/tasks']].forEach(([label,href])=>{const row=document.createElement('a');row.className='k-desk-flow-item';row.href=href;row.innerHTML=`<span>${label}</span><strong>Open →</strong>`;todayList.appendChild(row);});
    today.appendChild(todayList);

    const agentObjectivesCard = makeDeskModule('agent-objectives','Working now','What Kurukoo is keeping moving','See active work, what is waiting, and the next confirmed step without managing internal machinery.',[{label:'View work overview',href:'/agents',tone:'primary'}]);
    agentObjectivesCard.appendChild(makeDeskState('empty','Nothing is running right now','Tell Kurukoo what you want to get done and this view will keep the work in context.',{label:'Start in Chat',href:'/chat'}));
    const requestCard = makeDeskModule('active-requests','Requests','Coordination in motion','Follow what is being arranged, what changed, and what needs a decision.',[{label:'View Requests',href:'/requests',tone:'primary'}]);
    requestCard.appendChild(makeDeskState('empty','Nothing is being arranged right now','When you need something arranged, Kurukoo will keep it here.',{label:'Start in Chat',href:'/chat'}));
    const taskCard = makeDeskModule('tasks-reminders','Next actions','Small steps that move work forward','Tasks and reminders stay connected to the work they support.',[{label:'View Tasks',href:'/tasks',tone:'primary'}]);
    taskCard.appendChild(makeDeskState('empty','Nothing needs doing right now','When a concrete next action is ready, Kurukoo will keep it here with its context.',{label:'Ask Kurukoo',href:'/chat'}));
    const outcomesCard = makeDeskModule('recent-outcomes','Recent outcomes','What has been completed','Completed work stays visible here, with the original request or task available for context.',[{label:'View Requests',href:'/requests',tone:'secondary'}]);
    outcomesCard.appendChild(makeDeskState('empty','No recent outcomes yet','When work is confirmed as done, Kurukoo will keep a concise record here.'));
    const opportunityCard = makeDeskModule('opportunity-radar','Opportunities','Useful possibilities','Discover can surface people, services, offers, and local context when it is relevant. Nothing is presented as confirmed until its source supports it.',[{label:'Explore Discover',href:'/discover',tone:'primary'}]);
    const channelsCard = makeDeskModule('connected-channels','Keep in touch','People and connections','Manage the people, services, and channels that can help Kurukoo coordinate your work.',[{label:'Open Connect',href:'/connect',tone:'secondary'}]);

    [welcome,today,agentObjectivesCard,requestCard,taskCard,outcomesCard].forEach((card)=>main.appendChild(card));

    const pulse=makeDeskModule('pulse','Recent changes','What changed since you last looked','Important updates stay concise and lead back to the exact work they relate to.',[{label:'Open Updates',href:'/notifications'}]);
    pulse.appendChild(makeDeskState('empty','You are up to date','No recent update needs your attention.'));
    [pulse,opportunityCard,channelsCard].forEach((card)=>rail.appendChild(card));

    root.append(main,rail);
    old.replaceWith(root);


  };

  const wireDrawer = (panel, render) => {
    const button = panel && document.querySelector(`[aria-controls="${panel.id}"]`);
    if (!panel || !button) return;
    button.addEventListener('click', () => { if(panel.hidden){closeAll();panel.hidden=false;button.setAttribute('aria-expanded','true');render(panel.querySelector('.k-desk-drawer-body'));}else closeAll(); });
  };

  const boot = () => {
    // Header, navigation, search and account controls are owned by views/app.ejs.
    // Desk owns only its Brief composition, preventing a second legacy control row.
    renderDeskComposition();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
