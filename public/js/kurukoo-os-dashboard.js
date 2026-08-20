(() => {
  const boot = () => {
    const body = document.body;
    if (!body?.classList.contains('k-app-page')) return;
    body.classList.add('k-os-surface');

    const header = document.querySelector('.k-app-header');
    if (header && !header.querySelector('.os-app-command')) {
      const command = document.createElement('div');
      command.className = 'os-app-command';
      command.innerHTML = '<span aria-hidden="true">✧</span><span>Ask Kurukoo anything...</span><kbd>⌘ K</kbd>';
      header.appendChild(command);
    }

    const actions = document.querySelector('.k-app-header-actions');
    if (actions && !actions.querySelector('.os-header-status')) {
      const status = document.createElement('span');
      status.className = 'os-header-status';
      status.innerHTML = '<i aria-hidden="true"></i><span>All systems in sync</span>';
      actions.prepend(status);
    }

    const container = document.querySelector('.k-app-container');
    if (!container) return;
    const section = String(document.body.dataset.kAppSection || window.location.pathname.split('/').pop() || 'agent');
    if (section !== 'agent' && section !== '') return;
    if (container.dataset.osDashboardReady === 'true') return;
    container.dataset.osDashboardReady = 'true';

    const name = document.querySelector('.k-app-identity strong')?.textContent?.trim() || 'there';
    const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24"><use href="/icons/kurukoo-icons.svg#${name}"></use></svg>`;
    container.innerHTML = `
      <div class="os-greeting">
        <div><div class="k-os-label">Orbit</div><h1>Good day, ${escapeHtml(name)}</h1><p>Here’s the useful part of your day.</p></div>
        <a class="k-app-primary" href="/chat">Start something <span aria-hidden="true">→</span></a>
      </div>
      <div class="os-dashboard">
        <div class="os-dashboard-main">
          <div class="os-today-flow">
            <section class="k-os-card os-card-pad">
              <div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box">${icon('request')}</div><h2 class="os-section-title">Today’s flow</h2></div><a class="k-os-link" href="/app/requests">View all</a></div>
              <div class="os-timeline">
                <a class="os-timeline-item" href="/app/requests"><span class="os-mini-icon">${icon('request')}</span><span><strong>Review your active requests</strong><small>See anything waiting for your input.</small></span><span class="os-timeline-time">Now</span></a>
                <a class="os-timeline-item" href="/app/reminders"><span class="os-mini-icon">${icon('reminder')}</span><span><strong>Check reminders</strong><small>Keep today’s important follow-ups visible.</small></span><span class="os-timeline-time">Today</span></a>
                <a class="os-timeline-item" href="/chat"><span class="os-mini-icon">${icon('chat')}</span><span><strong>Continue a conversation</strong><small>Pick up where you left off.</small></span><span class="os-timeline-time">Anytime</span></a>
              </div>
            </section>
            <section class="k-os-card os-card-pad os-chat-preview">
              <div><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box" style="background:#e7f0ed;color:#5d957c">${icon('chat')}</div><h2 class="os-section-title">Continue conversation</h2></div></div>
                <div class="os-chat-bubble os-chat-bubble--user">I need help getting something done.</div>
                <div class="os-chat-bubble os-chat-bubble--assistant">Kurukoo can turn the request into a clear next step, reminder, discovery action or supported fulfilment flow.</div>
              </div>
              <a class="os-chat-open" href="/chat"><span>Open Chat</span><span aria-hidden="true">↗</span></a>
            </section>
          </div>

          <div class="os-grid-3">
            <section class="k-os-card os-card-pad os-feature-card"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box">${icon('request')}</div><h2 class="os-section-title">Active requests</h2></div><a class="k-os-link" href="/app/requests">View all</a></div><p class="k-os-muted">Your request timeline, provider responses and next confirmations live here.</p><a class="os-feature-action" href="/app/requests"><span>Open Requests</span><span>→</span></a></section>
            <section class="k-os-card os-card-pad os-feature-card"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box" style="background:#eaf0f4;color:#769eb7">${icon('work')}</div><h2 class="os-section-title">Tasks &amp; reminders</h2></div><a class="k-os-link" href="/app/tasks">View all</a></div><p class="k-os-muted">Keep personal reminders and longer-running work connected to the same Kurukoo relationship.</p><a class="os-feature-action" href="/app/tasks"><span>Open Tasks</span><span>→</span></a></section>
            <section class="k-os-card os-card-pad os-feature-card"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box" style="background:#e9f0ec;color:#5d957c">${icon('discover')}</div><h2 class="os-section-title">Opportunity radar</h2></div><a class="k-os-link" href="/app/opportunities">Explore</a></div><p class="k-os-muted">Discover local providers, products, promotions, Topics and opportunities worth your attention.</p><a class="os-feature-action" href="/app/discover"><span>Open Discover</span><span>→</span></a></section>
          </div>

          <div class="os-grid-3">
            <section class="k-os-card os-card-pad"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box" style="background:#edf3ef;color:#5d957c">${icon('points')}</div><h2 class="os-section-title">Points</h2></div><a class="k-os-link" href="/app/points">Manage</a></div><div class="os-points-value">—</div><div class="os-points-meta"><span>Balance is shown from your account</span><span>View →</span></div><div class="os-progress"><i></i></div></section>
            <section class="k-os-card os-card-pad"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box" style="background:#f5ece3;color:#9a7547">${icon('discover')}</div><h2 class="os-section-title">Topics for you</h2></div><a class="k-os-link" href="/topics">Manage</a></div><p class="k-os-muted">Follow local questions, community knowledge and useful conversations without leaving the Kurukoo network.</p><div class="os-tags"><a class="os-tag" href="/topics">Transport</a><a class="os-tag" href="/topics">Work</a><a class="os-tag" href="/topics">Home</a></div></section>
            <section class="k-os-card os-card-pad"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box" style="background:#eaf0f4;color:#769eb7">${icon('document')}</div><h2 class="os-section-title">Guide &amp; how-to</h2></div><a class="k-os-link" href="/resources">View all</a></div><p class="k-os-muted">Help Centre, guides, how-to videos and resources stay connected to the same OS.</p><a class="os-feature-action" href="/help"><span>Open Help Centre</span><span>→</span></a></section>
          </div>

          <div class="os-grid-2">
            <section class="k-os-card os-card-pad"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box">${icon('work')}</div><h2 class="os-section-title">Connected channels</h2></div><a class="k-os-link" href="/channels">Manage</a></div><div class="os-timeline"><a class="os-timeline-item" href="/channels"><span class="os-mini-icon">${icon('chat')}</span><span><strong>Web Chat</strong><small>Primary conversation surface</small></span><span class="k-os-chip k-os-chip--green">Active</span></a><a class="os-timeline-item" href="/channels"><span class="os-mini-icon">${icon('channels')}</span><span><strong>WhatsApp</strong><small>Same Kurukoo relationship</small></span><span class="k-os-chip">Setup available</span></a><a class="os-timeline-item" href="/channels"><span class="os-mini-icon">${icon('channels')}</span><span><strong>Telegram</strong><small>Same request and context model</small></span><span class="k-os-chip">Setup available</span></a></div></section>
            <section class="k-os-card os-card-pad"><div class="os-card-head"><div class="os-card-head-left"><div class="k-os-icon-box" style="background:#f7ece6;color:var(--os-accent)">${icon('package')}</div><h2 class="os-section-title">Sponsored provider match</h2></div><span class="k-os-chip k-os-chip--accent">Ad</span></div><div class="os-opportunity"><div class="os-opportunity-avatar"><div style="width:100%;height:100%;display:grid;place-items:center;background:#292d2a;color:#fff;font-weight:800;font-size:11px">Provider</div></div><div><strong>Relevant local provider promotion</strong><p>Paid visibility is clearly disclosed and can open the same Chat / Discover / request path as organic providers.</p></div></div><a class="os-feature-action" href="/advertise"><span>Learn about promotion</span><span>→</span></a></section>
          </div>
        </div>

        <aside class="os-dashboard-rail">
          <section class="k-os-card os-rail-card"><div class="os-card-head"><div><div class="k-os-label">Pulse</div><h2 class="os-section-title" style="margin-top:4px">Today’s timeline</h2></div><a class="k-os-link" href="/app/reminders">↻</a></div><div class="os-pulse-line"><a class="os-pulse-item" href="/app/requests"><span class="os-pulse-dot is-live"></span><span class="os-pulse-copy"><strong>Review active request</strong><small>Continue in Requests</small></span><span class="os-pulse-time">Now</span></a><a class="os-pulse-item" href="/app/tasks"><span class="os-pulse-dot"></span><span class="os-pulse-copy"><strong>Check tasks &amp; reminders</strong><small>Keep today on track</small></span><span class="os-pulse-time">Today</span></a><a class="os-pulse-item" href="/discover"><span class="os-pulse-dot"></span><span class="os-pulse-copy"><strong>Explore today’s picks</strong><small>Local offers &amp; opportunities</small></span><span class="os-pulse-time">Today</span></a></div></section>
          <section class="k-os-card os-rail-card os-safety"><div class="os-card-head"><div><div class="k-os-label">Safety check-in</div><h3>All good</h3></div><div class="k-os-icon-box" style="background:#fff;color:#5d957c">${icon('safety')}</div></div><p>No active alerts. Open Safety to manage check-ins, trusted contacts and consent-bound continuity.</p><a class="os-feature-action" href="/app/safety"><span>Run check-in</span><span>→</span></a></section>
          <section class="k-os-card os-rail-card"><div class="os-card-head"><div><div class="k-os-label">Activity summary</div><h2 class="os-section-title" style="margin-top:4px">This week</h2></div><span class="k-os-chip">Overview</span></div><div class="os-activity-bars"><div class="os-activity-day"><div class="os-activity-bar" style="height:42%"></div><small>Mon</small></div><div class="os-activity-day"><div class="os-activity-bar" style="height:58%"></div><small>Tue</small></div><div class="os-activity-day"><div class="os-activity-bar is-hot" style="height:78%"></div><small>Wed</small></div><div class="os-activity-day"><div class="os-activity-bar" style="height:66%"></div><small>Thu</small></div><div class="os-activity-day"><div class="os-activity-bar" style="height:54%"></div><small>Fri</small></div><div class="os-activity-day"><div class="os-activity-bar" style="height:35%"></div><small>Sat</small></div><div class="os-activity-day"><div class="os-activity-bar" style="height:48%"></div><small>Sun</small></div></div><a class="os-feature-action" href="/app/tasks"><span>View activity</span><span>→</span></a></section>
          <section class="k-os-card os-quote"><p>“Small steps today, big freedom tomorrow.”</p></section>
        </aside>
      </div>`;
  };

  const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[char]));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();