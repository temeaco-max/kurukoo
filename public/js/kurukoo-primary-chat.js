(() => {
  const state = {
    conversationId: localStorage.getItem('kurukoo_conversation_id') || '',
    displayName: '', authStep: 'none', messages: [], busy: false, attached: null, controller: null,
    theme: localStorage.getItem('kurukoo_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    activeStorefrontId: null,
    nativeAssistance: { reminders: [], checkIns: [] },
    lastCapabilityResult: null,
    pinnedMessages: [], surfaceView: null, canonicalContextAction: null, notifiedNotificationIds: new Set(), notifiedTrustChallengeIds: new Set(), radarActive: localStorage.getItem('kurukoo_radar_enabled') !== '0', radarLive: false, lastAgentBriefId: null
  };
  const $ = id => document.getElementById(id);
  const chatContent = $('chat-content'), scroll = $('chat-scroll'), input = $('message-input'), send = $('send-message'), stop = $('stop-generation');
  const activityStages = ['Reviewing your request', 'Checking the relevant context', 'Preparing a clear response'];
  const draftStorageKey = () => `kurukoo_chat_draft_${state.conversationId || 'guest'}`;
  function saveComposerDraft() {
    if (!input) return;
    try {
      const value = input.value.slice(0, 12000);
      if (value.trim()) sessionStorage.setItem(draftStorageKey(), value);
      else sessionStorage.removeItem(draftStorageKey());
    } catch {}
  }
  function clearComposerDraft() {
    try { sessionStorage.removeItem(draftStorageKey()); } catch {}
  }
  function restoreComposerDraft() {
    if (!input || input.value) return;
    try {
      const draft = sessionStorage.getItem(draftStorageKey());
      if (!draft) return;
      input.value = draft.slice(0, 12000);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {}
  }
  let activityTimer = null;
  let activityStageIndex = 0;
  const pinStorageKey = () => `kurukoo_pins_${state.conversationId || 'draft'}`;
  function savePinnedMessages() { try { localStorage.setItem(pinStorageKey(), JSON.stringify(state.pinnedMessages)); } catch {} }
  function loadPinnedMessages() { try { const parsed = JSON.parse(localStorage.getItem(pinStorageKey()) || '[]'); state.pinnedMessages = Array.isArray(parsed) ? parsed.slice(0, 12) : []; } catch { state.pinnedMessages = []; } renderPinnedMessages(); }
  function renderPinnedMessages() { const card = $('pinned-card'), list = $('pinned-list'); if (!card || !list) return; card.hidden = false; list.replaceChildren(); if (!state.pinnedMessages.length) { list.appendChild(makeElement('p', 'empty-state', 'Long-press or right-click a message to pin it here.')); return; } state.pinnedMessages.forEach(pin => { const row = makeElement('div', 'pinned-message'); const reference = makeElement('button', 'pinned-message-reference', pin.text); reference.type = 'button'; reference.title = 'Jump to pinned message'; reference.addEventListener('click', () => { const target = chatContent.querySelector(`[data-pin-key="${CSS.escape(pin.key)}"]`); if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('message-pinned-focus'); setTimeout(() => target.classList.remove('message-pinned-focus'), 1200); } }); const remove = makeElement('button', 'text-btn', 'Unpin'); remove.type = 'button'; remove.addEventListener('click', () => togglePinnedMessage(pin.key)); row.append(reference, remove); list.appendChild(row); }); }
  function togglePinnedMessage(key, message = null) { const index = state.pinnedMessages.findIndex(pin => pin.key === key); if (index >= 0) state.pinnedMessages.splice(index, 1); else if (message) state.pinnedMessages.unshift({ key, role: message.role, text: String(message.text || '').slice(0, 280) }); else return; savePinnedMessages(); renderPinnedMessages(); }
  function wirePinGestures(wrap, role, text) { const key = wrap.dataset.pinKey || (wrap.dataset.messageId ? `message-${wrap.dataset.messageId}` : `local-${crypto.randomUUID()}`); wrap.dataset.pinKey = key; const toggle = () => togglePinnedMessage(key, { role, text }); let timer = null; wrap.addEventListener('contextmenu', event => { event.preventDefault(); toggle(); }); wrap.addEventListener('pointerdown', event => { if (event.pointerType !== 'touch' || event.target.closest('button,a,input,textarea')) return; timer = setTimeout(() => { timer = null; toggle(); }, 560); }); ['pointerup','pointercancel','pointerleave','pointermove'].forEach(type => wrap.addEventListener(type, () => { if (timer) { clearTimeout(timer); timer = null; } })); }


  const makeElement = (tag, className = '', text = '') => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== '' && !Array.isArray(text)) el.textContent = text;
    return el;
  };
  const makeChildren = (tag, className = '', children = []) => {
    const el = makeElement(tag, className);
    el.append(...children.filter(Boolean));
    return el;
  };
  const makeIcon = (name, label = '') => {
    const icon = document.createElement('svg');
    icon.className = 'k-icon';
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElement('use');
    use.setAttribute('href', `/icons/kurukoo-icons.svg#${name}`);
    icon.appendChild(use);
    if (label) icon.setAttribute('data-icon-label', label);
    return icon;
  };
  const surfacePaths = { cart: '/cart', points: '/points', topup: '/top-up', subscription: '/subscription', requests: '/requests', reminders: '/reminders', saved: '/saved', tasks: '/tasks', 'daily-picks': '/daily-picks', discover: '/discover', connect: '/channels', memory: '/memory', safety: '/safety', settings: '/settings', topics: '/topics' };
  const surfaceTitles = { cart: 'Cart', points: 'Points', topup: 'Top up', subscription: 'Subscription', requests: 'Requests', reminders: 'Reminders', saved: 'Saved & offers', tasks: 'Tasks', 'daily-picks': 'Daily Picks', discover: 'Discover', connect: 'Connect', memory: 'Memory', safety: 'Safety & check-ins', settings: 'Settings', topics: 'Topics' };
  function updateSurfaceHeader(view = null) {
    const title = $('header-context-title'); const back = $('surface-header-back');
    if (title) title.textContent = view ? (surfaceTitles[view] || 'Workspace') : 'Agent';
    if (back) { back.hidden = !view; back.setAttribute('aria-label', view ? `Back from ${surfaceTitles[view] || 'workspace'}` : 'Back to conversation'); }
  }
  function updateSurfaceContext(view = null) {
    const inspector = $('chat-inspector'); if (!inspector) return;
    const title = $('inspector-title'); if (title) title.textContent = view ? (surfaceTitles[view] || 'Context') : 'Context';
    inspector.setAttribute('aria-label', view ? `${surfaceTitles[view] || 'Workspace'} context` : 'Conversation context');
    if (state.surfaceContextTimer) window.clearTimeout(state.surfaceContextTimer);
    inspector.classList.add('is-swapping');
    const cards = Array.from(inspector.querySelectorAll('[data-context-card]'));
    const goal = $('agent-goal-card');
    if (goal && !goal.dataset.contextCard) cards.push(goal);
    cards.forEach(card => {
      const tokens = String(card.dataset.contextCard || '').split(/\s+/).filter(Boolean);
      const relevant = card.id === 'agent-goal-card'
        ? (!view || (['tasks','requests','reminders'].includes(view) && card.dataset.goalAvailable === 'true'))
        : (!view || tokens.includes('all') || tokens.includes(view));
      card.hidden = false;
      card.classList.toggle('is-context-leaving', !relevant);
      card.classList.toggle('is-context-entering', relevant);
    });
    state.surfaceContextTimer = window.setTimeout(() => {
      cards.forEach(card => {
        const leaving = card.classList.contains('is-context-leaving');
        if (leaving) card.hidden = true;
        card.classList.remove('is-context-leaving', 'is-context-entering');
      });
      inspector.classList.remove('is-swapping');
    }, 220);
  }
  function leaveWorkspaceSurface() {
    state.surfaceView = null; updateSurfaceHeader(null); updateSurfaceContext(null); chatContent.replaceChildren(); if (state.messages.length) renderMessages(state.messages); else renderWelcome();
  }
  const guestSurfaceCopy = {
    requests: ['Your requests stay connected here.', 'Start with the conversation and Kurukoo will keep the request, clarification and next step together.'],
    reminders: ['Keep important follow-ups connected.', 'Ask Kurukoo to remind you about something and it will appear here after the reminder is created.'],
    saved: ['Save useful options for later.', 'Offers, discoveries and request context you choose to keep will appear here.'],
    cart: ['Review sourced items before checkout.', 'Choose a seller offer in Chat first. Nothing is purchased or reserved until the canonical checkout boundary confirms it.'],
    points: ['Your Points balance', 'Points and eligible activity are shown here only when the account and deployment state make them available.'],
    tasks: ['Work that needs your attention.', 'Tasks and follow-ups will appear here as Kurukoo coordinates them. Guest conversations can continue in Chat without losing their context.'],
    'daily-picks': ['Useful suggestions, clearly labelled.', 'Daily Picks combines relevant activity and approved sponsored content. It never presents an advertisement as a personal recommendation without disclosure.'],
    discover: ['Find useful things around you.', 'Explore services, opportunities, events and places through source-attributed discovery. A discovered entity is not treated as a Kurukoo provider until it is claimed and verified.'],
    connect: ['Connect your access points.', 'Set up WhatsApp, Telegram and other channels for the same Kurukoo relationship. A channel is not described as connected until provider evidence confirms it.'],
    topics: ['Useful community context.', 'Read and contribute local questions, reports and experiences. Topics provide context; they do not confirm provider identity, price, stock or availability.'],
    memory: ['Your retained context stays under your control.', 'Memory becomes available after you establish your account. You can review and remove active facts without changing conversation history.'],
    safety: ['Safety and check-ins.', 'Manage safety context and choose the next action. Kurukoo is not an emergency service and will not imply that a contact was notified without delivery evidence.'],
    settings: ['Your Kurukoo settings.', 'Account, privacy, notifications, memory, security and channel preferences are managed here.'],
    topup: ['Top up without surprises.', 'Review available balance actions. A payment is never described as complete without provider evidence.'],
    subscription: ['Review your subscription path.', 'Plans, eligibility and payment boundaries are shown here without claiming a completed subscription.'],
  };
  function renderGuestSurface(view) {
    const copy = guestSurfaceCopy[view] || ['Continue in Chat.', 'Tell Kurukoo what you need and it will keep the relevant context connected.'];
    const panel = makeElement('section', 'workspace-panel surface-guest-panel');
    const heading = makeElement('div', 'panel-heading');
    heading.append(makeChildren('div', '', [makeElement('span', 'workspace-eyebrow', surfaceTitles[view] || 'Workspace'), makeElement('h2', '', copy[0])]));
    heading.append(makeElement('span', 'status-pill', 'Guest view'));
    panel.append(heading, makeElement('p', 'workspace-note', copy[1]));
    const actions = makeElement('div', 'workspace-actions');
    const ask = makeElement('button', 'workspace-button secondary', 'Ask Kurukoo'); ask.type = 'button'; ask.addEventListener('click', () => input?.focus());
    const back = makeElement('button', 'workspace-button secondary', 'Back to conversation'); back.type = 'button'; back.addEventListener('click', leaveWorkspaceSurface);
    actions.append(ask, back); panel.append(actions);
    return panel;
  }
  async function renderWorkspaceSurface(view) {
    if (!chatContent || !surfacePaths[view]) return;
    state.surfaceView = view; updateSurfaceHeader(view); updateSurfaceContext(view); loadNearbyInspector(view);
    const surface = makeElement('section', 'workspace-surface'); surface.dataset.surfaceView = view;
    const heading = makeElement('div', 'surface-heading'); heading.append(makeElement('h1', '', surfaceTitles[view] || 'Workspace'));
    { const ask = makeElement('button', 'workspace-button secondary ask-cta'); ask.type = 'button'; const mark = makeElement('span', 'ask-mark'); const image = document.createElement('img'); image.src = '/assets/brand/logo-icon.png'; image.alt = ''; image.setAttribute('aria-hidden', 'true'); mark.append(image); ask.append(mark, makeElement('span', '', 'Ask')); ask.addEventListener('click', () => input?.focus()); heading.append(ask); }
    surface.append(heading); const body = makeElement('div', 'surface-body'); body.append(makeElement('div', 'surface-loading', 'Loading…')); surface.append(body); chatContent.replaceChildren(surface); scroll.scrollTop = 0;
    try {
      if (view === 'points') { const res = await fetch('/api/points/balance', { credentials: 'same-origin' }); const data = await res.json().catch(() => ({})); body.replaceChildren(makeElement('div', 'surface-stat-card', `${Number(data.points || 0)} Points`), makeElement('p', '', 'Points balance is shown here without leaving the conversation workspace.')); return; }
      if (view === 'cart') { const res = await fetch('/api/cart', { credentials: 'same-origin' }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || 'Cart is unavailable'); const items = Array.isArray(data.items) ? data.items : []; const panel = makeElement('section', 'workspace-panel'); panel.appendChild(makeChildren('div', 'panel-heading', [makeChildren('div', '', [makeElement('span', 'workspace-eyebrow', 'Review cart'), makeElement('h2', '', items.length ? 'Offers you chose to review' : 'Your review cart is empty')])])); if (!items.length) panel.appendChild(makeElement('p', 'empty-state', 'Choose a sourced seller offer in Chat before starting checkout.')); else { const list = makeElement('div', 'storefront-review-list'); items.forEach(item => { const row = makeElement('article', 'storefront-review-item'); const copy = makeElement('div'); copy.append(makeElement('strong', '', String(item.title || 'Seller offer')), makeElement('small', '', `${String(item.quantity || 1)} × ${item.price_minor === null ? 'Price pending confirmation' : `${item.price_minor} ${item.currency || 'local currency'}`}`)); const remove = makeElement('button', 'sf-btn sf-secondary', 'Remove'); remove.type = 'button'; remove.addEventListener('click', async () => { await fetch(`/api/cart/items/${encodeURIComponent(item.id)}`, { method: 'DELETE', credentials: 'same-origin' }); await renderWorkspaceSurface('cart'); }); row.append(copy, remove); list.appendChild(row); }); panel.appendChild(list); const checkout = makeElement('button', 'sf-btn sf-primary', 'Continue to checkout review'); checkout.type = 'button'; const status = makeElement('p', 'empty-state'); checkout.addEventListener('click', async () => { checkout.disabled = true; const result = await fetch('/api/cart/checkout', { method: 'POST', credentials: 'same-origin' }); const resultData = await result.json().catch(() => ({})); status.textContent = resultData.message || resultData.error || 'Checkout needs review.'; checkout.disabled = false; }); panel.appendChild(checkout); panel.appendChild(status); } body.replaceChildren(panel); return; }
      if (view === 'memory') {
        const res = await fetch('/api/memory/facts', { credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Memory is unavailable');
        const facts = Array.isArray(data.facts) ? data.facts : [];
        const panel = makeElement('section', 'workspace-panel');
        const heading = makeElement('div', 'panel-heading');
        heading.append(makeChildren('div', '', [makeElement('span', 'workspace-eyebrow', 'Your retained context'), makeElement('h2', '', facts.length ? 'Review what Kurukoo may use' : 'Nothing is retained yet')]));
        heading.append(makeElement('span', 'status-pill', 'Owner controlled'));
        panel.appendChild(heading);
        panel.appendChild(makeElement('p', 'workspace-note', 'These are active fact-level memories connected to your account. Removing one stops it from active retrieval; it does not change your conversation history.'));
        if (!facts.length) panel.appendChild(makeElement('p', 'empty-state', 'Tell Kurukoo what you would like it to remember, or continue your conversation without saving a preference.'));
        else {
          const list = makeElement('div', 'workspace-data-list');
          facts.forEach(fact => {
            const row = makeElement('article', 'workspace-data-row');
            const copy = makeElement('div');
            copy.append(makeElement('strong', '', `${String(fact.field || 'Context')}: ${String(fact.value || '')}`), makeElement('small', '', `Provenance: ${String(fact.provenance || 'unknown').replace(/_/g, ' ')}`));
            const remove = makeElement('button', 'text-btn text-btn-danger', 'Remove');
            remove.type = 'button';
            remove.addEventListener('click', async () => {
              remove.disabled = true;
              try {
                const result = await fetch(`/api/memory/facts/${encodeURIComponent(fact.id)}`, { method: 'DELETE', credentials: 'same-origin' });
                const resultData = await result.json().catch(() => ({}));
                if (!result.ok) throw new Error(resultData.error || 'Memory fact could not be removed.');
                await renderWorkspaceSurface('memory');
              } catch (error) { remove.disabled = false; setInspectorFeedback(error.message || 'Memory fact could not be removed.', 'error'); }
            });
            row.append(copy, remove); list.appendChild(row);
          });
          panel.appendChild(list);
        }
        body.replaceChildren(panel); return;
      }
      const res = await fetch(surfacePaths[view], { credentials: 'same-origin' });
      const finalPath = new URL(res.url || surfacePaths[view], location.origin).pathname;
      if (finalPath === '/login') { body.replaceChildren(renderGuestSurface(view)); return; }
      if (!res.ok) throw new Error('Workspace view unavailable');
      const html = await res.text(); const doc = new DOMParser().parseFromString(html, 'text/html'); const source = doc.querySelector('.workspace-content, main, .workspace-main'); if (!source) throw new Error('Workspace content unavailable');       body.replaceChildren(...Array.from(source.childNodes).map(node => node.cloneNode(true))); body.querySelector('.workspace-header')?.remove(); body.querySelector('[data-tasks-activity]') && loadTasksActivity(); body.querySelectorAll('script').forEach(script => script.remove()); body.querySelectorAll('a[href]').forEach(link => { const href = link.getAttribute('href') || ''; const mapped = Object.entries(surfacePaths).find(([, path]) => href === path || href.startsWith(`${path}?`)); if (mapped) { link.dataset.surfaceView = mapped[0]; link.removeAttribute('href'); } }); body.querySelectorAll('a.ask-cta').forEach(link => { link.addEventListener('click', event => { event.preventDefault(); const prompt = new URL(link.href || link.getAttribute('data-href') || '/chat', location.origin).searchParams.get('prompt'); if (prompt && input) { input.value = prompt; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); } }); }); wireSurfaceActions(body);
    } catch (error) {
      body.replaceChildren(renderGuestSurface(view));
      setInspectorFeedback(error.message || 'This surface is unavailable right now.', 'error');
    }
  }
  async function loadConversation(conversationId) { if (!conversationId) return; state.surfaceView = null; updateSurfaceHeader(null); updateSurfaceContext(null); state.conversationId = conversationId; localStorage.setItem('kurukoo_conversation_id', conversationId); restoreComposerDraft(); try { const url = new URL('/api/chat/history', location.origin); url.searchParams.set('conversationId', conversationId); url.searchParams.set('limit', '60'); const res = await fetch(url, { credentials: 'same-origin' }); const data = await res.json(); state.messages = (data.messages || []).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.content, id: m.id })); renderMessages(data.messages || []); refreshHistory(); } catch { setConnection(false, 'Offline'); } }
  function wireSurfaceActions(root = document) { root.querySelectorAll('[data-surface-view]').forEach(action => { if (action.dataset.surfaceWired === '1') return; action.dataset.surfaceWired = '1'; action.addEventListener('click', event => { event.preventDefault(); renderWorkspaceSurface(action.dataset.surfaceView); }); }); }

  function setComposerBusy(busy) {
    state.busy = busy;
    if (send) { send.hidden = busy; send.disabled = busy; }
    if (stop) stop.hidden = !busy;
    if (input) input.setAttribute('aria-busy', String(busy));
  }

  const setConnection = (ok, text = ok ? 'Connected' : 'Offline') => {
    const el = $('connection-status');
    if (el) {
      const pulse = makeElement('span', `presence-pulse${state.radarActive && ok ? ' is-active' : ''}`); pulse.setAttribute('aria-hidden', 'true');
      el.replaceChildren(pulse, makeElement('span', 'status-dot'), makeElement('span', '', String(text).toLowerCase()));
      el.classList.toggle('offline', !ok);
    }
    const pulse = $('header-presence-pulse'); if (pulse) pulse.classList.toggle('is-active', state.radarActive && ok);
    const label = $('connection-label'); if (label) label.textContent = String(text).toLowerCase();
  };
  function setRadarActive(active) {
    state.radarActive = Boolean(active); localStorage.setItem('kurukoo_radar_enabled', state.radarActive ? '1' : '0');
    const toggle = $('radar-toggle'); if (toggle) { toggle.setAttribute('aria-pressed', String(state.radarActive)); toggle.classList.toggle('is-active', state.radarActive); toggle.setAttribute('aria-label', state.radarActive ? 'Nearby Radar ready' : 'Turn on Nearby Radar'); }
    const status = $('radar-status'); if (status) status.textContent = state.radarActive ? (state.radarLive ? 'Live' : 'Ready') : 'Off';
    const pulse = $('header-presence-pulse'); if (pulse) pulse.classList.toggle('is-active', state.radarActive && !$('connection-status')?.classList.contains('offline'));
    const header = $('connection-status'); if (header) header.classList.toggle('radar-active', state.radarActive);
  }
  async function loadPulseReadiness() {
    try {
      const response = await fetch('/api/pulse/readiness', { credentials: 'same-origin' });
      if (!response.ok) return;
      const data = await response.json();
      state.radarLive = Boolean(data.active);
      setRadarActive(state.radarActive);
      const nudgeKey = `kurukoo_pulse_nudge_${data.active ? 'live' : data.eligibleToBroadcast ? 'provider' : 'consumer'}`;
      if (data.nudge && !sessionStorage.getItem(nudgeKey)) {
        sessionStorage.setItem(nudgeKey, '1');
        pushAgentSurfaceToast(data.active ? 'Nearby Pulse is live' : 'Nearby Radar is ready', data.nudge, false);
      }
    } catch {}
  }
  $('radar-toggle')?.addEventListener('click', () => setRadarActive(!state.radarActive));
  setRadarActive(state.radarActive);
  void loadPulseReadiness();
  restoreComposerDraft();
  const moreToggle = $('sidebar-more-toggle'); const moreItems = $('sidebar-more-items');
  moreToggle?.addEventListener('click', () => {
    const expanded = moreToggle.getAttribute('aria-expanded') === 'true';
    moreToggle.setAttribute('aria-expanded', String(!expanded));
    if (moreItems) moreItems.hidden = expanded;
    moreToggle.classList.toggle('is-expanded', !expanded);
  });
  let sponsoredAds = Array.isArray(window.KURUKOO_SPONSORED_ADS) ? window.KURUKOO_SPONSORED_ADS : [];
  let sponsoredIndex = -1;
  function renderSponsoredAd() {
    const card = $('sidebar-promo'); const image = card?.querySelector('img'); const tag = card?.querySelector('.sidebar-sponsored-tag');
    const dailyCard = $('daily-picks-promo-card'); const dailyImage = $('daily-picks-promo-image');
    if (!card || !image) return;
    if (!sponsoredAds.length) { card.hidden = true; if (dailyCard) dailyCard.hidden = true; return; }
    card.hidden = false;
    sponsoredIndex = (sponsoredIndex + 1) % sponsoredAds.length;
    const ad = sponsoredAds[sponsoredIndex];
    image.src = String(ad.image || ''); image.alt = String(ad.alt || ad.title || 'Sponsored local service');
    if (tag) tag.textContent = String(ad.disclosure || 'Sponsored');
    card.dataset.adId = String(ad.id || sponsoredIndex);
    if (dailyCard && dailyImage) {
      const dailyAd = sponsoredAds[(sponsoredIndex + 1) % sponsoredAds.length] || ad;
      dailyImage.src = String(dailyAd.image || ''); dailyImage.alt = String(dailyAd.alt || dailyAd.title || 'Daily Picks community discovery');
      dailyCard.hidden = false;
      dailyCard.dataset.adId = String(dailyAd.id || sponsoredIndex);
    }
  }
  async function loadSponsoredAds() {
    try {
      const res = await fetch('/api/chat/sponsored', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.campaigns) && data.campaigns.length) sponsoredAds = data.campaigns;
    } catch {}
    renderSponsoredAd();
    window.setInterval(() => { if (document.visibilityState === 'visible') renderSponsoredAd(); }, 6500);
  }
  loadSponsoredAds();

  function setTypingStatus(status = 'complete', label = '') {
    const active = status === 'typing' || status === 'thinking';
    let indicator = chatContent?.querySelector('[data-kurukoo-typing]');
    if (!active) {
      if (activityTimer) { clearInterval(activityTimer); activityTimer = null; }
      indicator?.remove();
      return;
    }
    if (!indicator) {
      indicator = document.createElement('article');
      indicator.className = 'typing-indicator message assistant';
      indicator.dataset.kurukooTyping = 'true';
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      indicator.setAttribute('aria-atomic', 'true');
      const avatar = makeElement('div', 'avatar'); avatar.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img'); image.src = '/assets/brand/logo-icon.png'; image.alt = ''; image.width = 20;
      avatar.appendChild(image);
      const bubble = makeElement('div', 'bubble typing-indicator-bubble');
      const text = makeElement('span', 'typing-indicator-label');
      const activity = makeElement('span', 'agent-activity-line');
      activity.setAttribute('aria-hidden', 'true');
      const orbit = makeElement('span', 'agent-activity-orbit');
      orbit.append(makeElement('i'), makeElement('i'), makeElement('i'));
      const stage = makeElement('span', 'agent-activity-stage', activityStages[activityStageIndex]);
      activity.append(orbit, stage);
      const dots = makeElement('span', 'typing-indicator-dots'); dots.setAttribute('aria-hidden', 'true');
      dots.append(makeElement('i'), makeElement('i'), makeElement('i'));
      bubble.append(text, activity, dots); indicator.append(avatar, bubble); chatContent?.appendChild(indicator);
      activityTimer = setInterval(() => {
        const current = chatContent?.querySelector('[data-kurukoo-typing] .agent-activity-stage');
        if (!current) return;
        activityStageIndex = (activityStageIndex + 1) % activityStages.length;
        current.textContent = activityStages[activityStageIndex];
      }, 2200);
    }
    indicator.dataset.status = status;
    const text = indicator.querySelector('.typing-indicator-label');
    if (text) text.textContent = label || (status === 'thinking' ? 'Kurukoo is considering the best next step…' : 'Kurukoo is typing…');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  const applyTheme = () => { document.body.classList.toggle('dark', state.theme === 'dark'); localStorage.setItem('kurukoo_theme', state.theme); };

  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,style,link,form').forEach(n => n.remove());
    doc.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || /^(javascript|data):/i.test(a.value)) n.removeAttribute(a.name); }));
    return doc.body.innerHTML;
  }

  function renderMarkdown(text) {
    if (!window.marked) return String(text || '').replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c])).replace(/\n/g, '<br>');
    marked.setOptions({ breaks: true, gfm: true });
    return sanitizeHtml(marked.parse(text || ''));
  }

  function setMarkdown(el, text) {
    const html = renderMarkdown(text);
    el.replaceChildren(document.createRange().createContextualFragment(html));
  }

  function enhanceCode(root) { root.querySelectorAll('pre code').forEach(block => { if (window.hljs && !block.dataset.highlighted) hljs.highlightElement(block); }); }
  function escapeAttr(value) { return String(value || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeText(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function updateNativeAssistanceStatus() {
    const banner = $('native-assistance-status'); if (!banner) return;
    const now = Date.now();
    const reminders = Array.isArray(state.nativeAssistance?.reminders) ? state.nativeAssistance.reminders : [];
    const checkIns = Array.isArray(state.nativeAssistance?.checkIns) ? state.nativeAssistance.checkIns : [];

    const activeCheckIns = checkIns.filter(item => item?.status === 'active' && item?.expires_at).map(item => ({ ...item, expiresAt: new Date(item.expires_at).getTime() })).filter(item => Number.isFinite(item.expiresAt)).sort((a, b) => a.expiresAt - b.expiresAt);
    const expiringCheckIn = activeCheckIns.find(item => item.expiresAt <= now + (2 * 60 * 60 * 1000));
    if (expiringCheckIn) {
      const when = expiringCheckIn.expiresAt <= now ? 'has reached its scheduled end' : `ends at ${new Date(expiringCheckIn.expiresAt).toLocaleString()}`;
      banner.textContent = `Personal safety check-in ${when}. Review it in the context inspector; no contact is notified automatically.`;
      banner.dataset.kind = 'safety'; banner.hidden = false; return;
    }

    const upcomingReminder = reminders.filter(item => item?.status === 'active' && item?.due_at).map(item => ({ ...item, dueAt: new Date(item.due_at).getTime() })).filter(item => Number.isFinite(item.dueAt) && item.dueAt <= now + (24 * 60 * 60 * 1000)).sort((a, b) => a.dueAt - b.dueAt)[0];
    if (upcomingReminder) {
      const title = String(upcomingReminder.title || 'Reminder');
      const due = upcomingReminder.dueAt <= now ? 'needs your attention now' : `is scheduled for ${new Date(upcomingReminder.dueAt).toLocaleString()}`;
      banner.textContent = `Reminder: ${title} ${due}. Review it in the context inspector.`;
      banner.dataset.kind = 'reminder'; banner.hidden = false; return;
    }
    banner.hidden = true; banner.textContent = '';
  }

  function showEmbedSignInGate() {
    if (!chatContent || chatContent.querySelector('[data-embed-signin-gate]')) return;
    const gate = document.createElement('div');
    gate.dataset.embedSigninGate = '1';
    gate.className = 'message assistant';

    const avatar = makeElement('div', 'avatar', 'K'); avatar.setAttribute('aria-hidden', 'true');
    const body = makeElement('div', 'message-body');
    const bubble = makeElement('div', 'bubble');
    const md = makeElement('div', 'markdown-body');
    const p1 = document.createElement('p'); p1.appendChild(makeElement('strong', '', 'Continue chatting with Kurukoo'));
    const p2 = document.createElement('p'); p2.textContent = 'Your Memory Profile and conversation history stay private until you complete the name, phone and verification conversation in full chat.';
    const p3 = document.createElement('p');
    const a1 = makeElement('a', 'primary-btn', 'Open full chat'); a1.href = '/chat'; a1.target = '_top'; a1.rel = 'noopener';
    p3.append(a1);
    md.append(p1, p2, p3);
    bubble.appendChild(md);
    body.appendChild(bubble);
    gate.append(avatar, body);

    chatContent.appendChild(gate);
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  async function ensureIdentity() {
    const sessionCheck = await fetch('/api/auth/me', { credentials: 'same-origin' }).catch(() => null);
    if (sessionCheck?.ok) {
      const sessionData = await sessionCheck.json().catch(() => ({}));
      setConnection(true);
      state.isGuest = false;
      state.displayName = sessionData.name || sessionData.user?.name || sessionData.profile?.name || '';
      const testBanner = $('development-test-banner');
      if (testBanner) testBanner.hidden = sessionData.developmentTestAccount !== true;
      const contextBanner = $('session-context-banner');
      const context = sessionData.sessionContext || {};
      if (contextBanner && (context.operator || context.testActor)) {
        contextBanner.hidden = false;
        contextBanner.textContent = context.testActor
          ? `Controlled Test As: ${context.actorRole || context.actorContextId || 'actor'} · isolated state · no production user data`
          : 'Canonical User #1 operator Chat · normal authenticated platform state';
      }
      return true;
    }

    if (sessionCheck?.status === 401) {
      state.isGuest = true;
      setConnection(true, 'guest');
      return true;
    }

    setConnection(false, 'Offline');
    return false;
  }

  async function startGuestAuth() {
    if (!state.isGuest) return 'none';
    try {
      const response = await fetch('/api/chat/auth/start', { method: 'POST', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      const steps = { awaiting_name: 'name', awaiting_phone: 'phone', awaiting_otp: 'otp', awaiting_email_phone: 'phone', awaiting_email_otp: 'otp' };
      return steps[data.state] || 'name';
    } catch { return 'name'; }
  }

  function setAuthComposerStep(step = 'none') {
    state.authStep = step;
    if (!input) return;
    const prompts = { name: 'Type your name…', phone: 'Type your phone number…', otp: 'Type the 6-digit code…' };
    input.placeholder = prompts[step] || (state.displayName ? 'Tell Kurukoo what you need…' : 'Tell Kurukoo what you need…');
    input.setAttribute('aria-label', step === 'name' ? 'Your name' : step === 'phone' ? 'Your phone number' : step === 'otp' ? 'Verification code' : 'Message Kurukoo');
  }

  function renderWelcomeAuth(step = 'name') {
    if (!state.isGuest) return;
    setAuthComposerStep(step);
    input?.focus();
  }

  function addHistoryItem(conversation, active = false) {
    const list = $('history-list'); if (!list || !conversation?.id) return;
    let item = list.querySelector(`[data-conversation-id="${CSS.escape(conversation.id)}"]`);
    if (!item) {
      item = document.createElement('button'); item.type = 'button'; item.className = 'history-item'; item.dataset.conversationId = conversation.id;
      item.addEventListener('click', () => loadConversation(conversation.id)); list.appendChild(item);
    }
    item.replaceChildren(); item.append(makeElement('span', 'history-title', conversation.title || 'New conversation'));
    try { const pins = JSON.parse(localStorage.getItem(`kurukoo_pins_${conversation.id}`) || '[]'); if (Array.isArray(pins) && pins.length) { const pin = makeIcon('saved', 'Pinned'); pin.classList.add('history-pin-indicator'); pin.setAttribute('aria-label', 'Pinned references'); item.appendChild(pin); } } catch {}
    item.classList.toggle('active', active);
  }

  function speakAssistantResponse(value, control) {
    const text = String(value || '').trim();
    const output = window.KurukooSpeechOutput;
    const spoken = Boolean(text && output?.isSupported?.() && output.speak(text, { language: document.documentElement.lang || navigator.language }));
    if (control) {
      control.setAttribute('aria-pressed', spoken ? 'true' : 'false');
      control.title = spoken ? 'Speaking response' : 'Browser speech output is unavailable';
    }
    return spoken;
  }

  function createMessage(role, text = '', id = null, cardData = null, animate = true) {
    const wrap = document.createElement('article'); wrap.className = `message ${role}`; wrap.dataset.messageState = animate ? 'incoming' : 'history'; if (animate) wrap.classList.add('message-enter'); if (id) wrap.dataset.messageId = id;

    const avatarDiv = makeElement('div', 'avatar'); avatarDiv.setAttribute('aria-hidden', 'true');
    if (role === 'assistant') {
      const img = document.createElement('img'); img.src = '/assets/brand/logo-icon.png'; img.alt = 'K'; img.width = 20;
      avatarDiv.appendChild(img);
    }

    const body = makeElement('div', 'message-body');
    const bubble = makeElement('div', 'bubble');
    const md = makeElement('div', 'markdown-body');
    setMarkdown(md, text);
    bubble.appendChild(md);

    const actions = makeElement('div', 'message-actions');
    const buttons = role === 'assistant' ? [['speak', 'Speak response', 'mic'], ['pin', 'Pin', 'saved'], ['copy', 'Copy', 'copy'], ['regenerate', 'Retry', 'retry'], ['delete', 'Delete', 'trash']] : [['pin', 'Pin', 'saved'], ['copy', 'Copy', 'copy'], ['edit', 'Edit', 'edit'], ['delete', 'Delete', 'trash']];
    buttons.forEach(([act, lab, iconName]) => {
      const btn = makeElement('button', 'message-action-btn');
      btn.type = 'button'; btn.dataset.action = act; btn.setAttribute('aria-label', lab); btn.title = lab;
      btn.appendChild(makeIcon(iconName, lab));
      actions.appendChild(btn);
    });

    body.append(bubble, actions);
    if (role === 'assistant') wrap.appendChild(avatarDiv);
    wrap.appendChild(body);

    actions.addEventListener('click', async event => {
      const button = event.target.closest('button'); if (!button) return; const action = button.dataset.action;
      if (action === 'pin') togglePinnedMessage(wrap.dataset.pinKey, { role, text });
      if (action === 'copy') await navigator.clipboard?.writeText(wrap.querySelector('.bubble').innerText);
      if (action === 'speak') speakAssistantResponse(wrap.querySelector('.bubble')?.innerText || text, button);
      if (action === 'edit') { input.value = text; input.focus(); input.dispatchEvent(new Event('input')); }
      if (action === 'delete') {
        if (state.isGuest) { alert('Please sign in to delete messages.'); return; }
        if (wrap.dataset.messageId) await deleteMessage(Number(wrap.dataset.messageId));
        wrap.remove();
      }
      if (action === 'regenerate') {
        if (state.isGuest) { alert('Please sign in to regenerate messages.'); return; }
        const lastUser = [...state.messages].reverse().find(m => m.role === 'user');
        if (lastUser) await sendMessage(lastUser.text);
      }
    });

    chatContent.appendChild(wrap);
    wirePinGestures(wrap, role, text);
    if (cardData) renderCard(cardData, wrap);
    scroll.scrollTop = scroll.scrollHeight;
    enhanceCode(wrap);
    return wrap;
  }

  function appendStreamBubble() {
    $('welcome')?.remove();
    const wrap = document.createElement('article'); wrap.className = 'message assistant message-enter message-streaming'; wrap.dataset.messageState = 'incoming'; wrap.hidden = true;

    const avatar = makeElement('div', 'avatar'); avatar.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img'); img.src = '/assets/brand/logo-icon.png'; img.alt = 'K'; img.width = 20;
    avatar.appendChild(img);

    const body = makeElement('div', 'message-body');
    const bubble = makeElement('div', 'bubble');
    bubble.appendChild(makeElement('div', 'markdown-body'));

    const thinking = makeElement('div', 'thinking'); thinking.hidden = true;
    const details = document.createElement('details');
    details.appendChild(makeElement('summary', '', 'Reasoning completed'));
    details.appendChild(makeElement('div', '', 'Kurukoo selected the appropriate response path. Private model reasoning is not exposed.'));
    thinking.appendChild(details);
    bubble.appendChild(thinking);

    const actions = makeElement('div', 'message-actions');
    [['speak', 'Speak response', 'mic'], ['copy', 'Copy', 'copy'], ['regenerate', 'Retry', 'retry'], ['delete', 'Delete', 'trash']].forEach(([act, lab, iconName]) => {
      const btn = makeElement('button', 'message-action-btn'); btn.type = 'button'; btn.dataset.action = act; btn.setAttribute('aria-label', lab); btn.title = lab; btn.appendChild(makeIcon(iconName, lab)); actions.appendChild(btn);
    });

    body.append(bubble, actions);
    wrap.append(avatar, body);
    actions.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button?.dataset.action === 'speak') speakAssistantResponse(wrap.querySelector('.bubble')?.innerText || '', button);
    });
    chatContent.appendChild(wrap);
    wirePinGestures(wrap, 'assistant', 'Kurukoo is responding…');
    return wrap;
  }

  function addUserMessage(text, id = null) { $('welcome')?.remove(); state.messages.push({ role: 'user', text, id }); return createMessage('user', text, id); }

  function setDeferredStatus(card) {
    const status = $('deferred-status');
    if (!status) return;
    if (!card) { status.hidden = true; return; }
    if (card.type === 'agentic_storefront') {
      if (card.stage === 'deferred') {
        status.hidden = false;
        status.textContent = '⏳ Request deferred — Kurukoo will retain the request for a supported next step. Any notification depends on a configured channel.';
      } else if (card.stage === 'fulfillment') {
        status.hidden = false;
        status.textContent = 'Fulfilment milestone recorded. Confirm completion to continue the documented request lifecycle.';
      } else if (['slot_fill', 'quote_review', 'offer_review', 'delivery_selection', 'seller_handover', 'delivery_in_progress'].includes(card.stage)) {
        status.hidden = false;
        status.textContent = `Request flow · ${card.stage.replace(/_/g, ' ')} · ${card.progress || 0}%`;
      } else {
        status.hidden = true;
      }
      return;
    }
    if (!['worker_match','service_search','nearby_radar'].includes(card.type)) { status.hidden = true; return; }
    status.hidden = false;
    status.textContent = card.type === 'nearby_radar'
      ? '📡 Checking request context for a supported nearby path…'
      : '🔎 Assessing the request for a supported match. If no path is currently available, the request can be deferred.';
  }

  function collectStorefrontFields(holder) {
    const fields = {};
    holder.querySelectorAll('[data-storefront-field]').forEach(el => {
      const key = el.getAttribute('data-storefront-field');
      if (key) fields[key] = el.value.trim();
    });
    return fields;
  }

  function markStorefrontStepSuperseded(messageEl, label = 'Submitted — see the latest request state below.') {
    const holder = messageEl?.querySelector('.agentic-storefront');
    if (!holder || !holder.querySelector('[data-storefront-field]') || holder.dataset.superseded === 'true') return;
    holder.dataset.superseded = 'true';
    holder.classList.add('storefront-superseded');
    holder.setAttribute('aria-label', 'Previous request step');
    holder.querySelectorAll('button, input, textarea, select').forEach(control => {
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    });
    const note = makeElement('small', 'storefront-superseded-note', label);
    holder.appendChild(note);
  }

  async function advanceStorefront(requestId, action, fields, messageEl) {
    if (!requestId || (state.busy && action !== 'cancel')) return;
    state.busy = true;
    if (send) send.disabled = true;
    try {
      const idempotencyKey = `chat:${state.conversationId || 'draft'}:${requestId}:${action}:${Object.entries(fields || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${String(value || '').slice(0, 120)}`).join('|')}`.slice(0, 180);
      const executorAction = !state.isGuest && ['cancel', 'select_provider', 'update'].includes(action);
      const res = executorAction
        ? await fetch('/api/chat/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ capability: 'economic_request', action, canonicalObjectId: requestId, arguments: fields || {}, conversationId: state.conversationId || undefined, idempotencyKey })
        })
        : await fetch(`/api/chat/economic-requests/storefront/${encodeURIComponent(requestId)}/advance`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ action, requirements: fields || {}, conversationId: state.conversationId || undefined, idempotencyKey })
        });
      if (res.status === 401) { await ensureIdentity(); throw new Error('Session expired'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not update request');
      const card = executorAction ? data.result?.canonicalFacts?.card : data.card;
      const message = executorAction ? (data.result?.message || card?.message || 'The exact request was updated.') : (card?.message || 'Updated.');
      markStorefrontStepSuperseded(messageEl);
      if (card) {
        setDeferredStatus(card);
        if (card.requestId) state.activeStorefrontId = card.requestId;
      }
      const wrap = appendStreamBubble();
      setMarkdown(wrap.querySelector('.markdown-body'), message);
      if (card) renderCard(card, wrap);
      state.messages.push({ role: 'assistant', text: message, id: null });
      scroll.scrollTop = scroll.scrollHeight;
      await loadPoints();
    } catch (error) {
      setConnection(false, 'Connection issue');
      const wrap = appendStreamBubble();
      setMarkdown(wrap.querySelector('.markdown-body'), `Could not continue that request. **${escapeText(error.message)}**`);
    } finally {
      state.busy = false;
      if (send) send.disabled = false;
    }
  }

  async function startKnownOffer(offerId) {
    if (!offerId || state.busy) return;
    state.busy = true;
    if (send) send.disabled = true;
    try {
      const res = await fetch(`/api/chat/economic-requests/offers/${encodeURIComponent(offerId)}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: '{}'
      });
      if (res.status === 401) { await ensureIdentity(); throw new Error('Session expired'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not start request from that offer');
      const card = data.card;
      setDeferredStatus(card);
      if (card?.requestId) state.activeStorefrontId = card.requestId;
      const wrap = appendStreamBubble();
      setMarkdown(wrap.querySelector('.markdown-body'), card.message || 'Offer selected.');
      renderCard(card, wrap);
      state.messages.push({ role: 'assistant', text: card.message || '', id: null });
      scroll.scrollTop = scroll.scrollHeight;
      await loadPoints();
    } catch (error) {
      const wrap = appendStreamBubble();
      setMarkdown(wrap.querySelector('.markdown-body'), `Could not select that offer. **${escapeText(error.message)}**`);
    } finally { state.busy = false; if (send) send.disabled = false; }
  }

  async function selectDeliveryCandidate(requestId, providerPhone) {
    if (!requestId || !providerPhone || state.busy) return;
    state.busy = true;
    if (send) send.disabled = true;
    try {
      const res = await fetch(`/api/chat/economic-requests/${encodeURIComponent(requestId)}/delivery-selection`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ providerPhone })
      });
      if (res.status === 401) { await ensureIdentity(); throw new Error('Session expired'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not select delivery provider');
      const card = data.card;
      setDeferredStatus(card);
      const wrap = appendStreamBubble();
      setMarkdown(wrap.querySelector('.markdown-body'), card.message || 'Delivery provider selected.');
      renderCard(card, wrap);
      state.messages.push({ role: 'assistant', text: card.message || '', id: null });
      scroll.scrollTop = scroll.scrollHeight;
    } catch (error) {
      const wrap = appendStreamBubble();
      setMarkdown(wrap.querySelector('.markdown-body'), `Could not select that delivery provider. **${escapeText(error.message)}**`);
    } finally { state.busy = false; if (send) send.disabled = false; }
  }

  function renderAgenticStorefront(card, messageEl) {
    const holder = makeElement('div', 'provider-card agentic-storefront');
    holder.dataset.requestId = String(card.requestId || '');
    holder.dataset.stage = String(card.stage || '');

    const progress = Math.max(0, Math.min(100, Number(card.progress) || 0));
    const progressClass = Math.round(progress / 10) * 10;
    const head = makeElement('div', 'storefront-head');
    head.append(
      makeElement('strong', '', card.title || 'Kurukoo'),
      makeElement('span', 'storefront-stage', String(card.stage || '').replace(/_/g, ' '))
    );
    holder.appendChild(head);

    const progressBar = makeElement('div', 'storefront-progress');
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuenow', String(progress));
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.appendChild(makeElement('i', `storefront-progress-meter progress-${progressClass}`));
    holder.appendChild(progressBar);

    if (Array.isArray(card.fields) && card.fields.length) {
      const fields = makeElement('div', 'storefront-fields');
      card.fields.forEach(field => {
        const key = String(field.key || '');
        const label = makeElement('label', 'storefront-field');
        const labelText = makeElement('span', '', field.label || key);
        if (field.required) labelText.appendChild(makeElement('span', 'req', '*'));
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.storefrontField = key;
        input.value = String(field.value || '');
        input.placeholder = String(field.label || key);
        input.autocomplete = 'off';
        label.append(labelText, input);
        fields.appendChild(label);
      });
      holder.appendChild(fields);
    }

    if (Array.isArray(card.knownOffers) && card.knownOffers.length) {
      const offers = makeElement('section', 'storefront-known-offers');
      offers.appendChild(makeElement('strong', '', 'Known seller offers'));
      const list = makeElement('ul', 'storefront-offers-list');
      card.knownOffers.forEach(offer => {
        const item = makeElement('li');
        const details = makeElement('div');
        const price = Number(offer.priceMinor);
        const amount = Number.isInteger(price) ? `${price} ${String(offer.currency || 'local currency')}` : 'Price pending confirmation';
        details.append(
          makeElement('strong', '', offer.description || 'Seller offer'),
          makeElement('span', '', `${String(offer.sellerName || 'Seller')} · ${amount}`)
        );
        if (offer.availabilityNote) details.appendChild(makeElement('small', '', String(offer.availabilityNote)));
        if (offer.provenance || offer.externalSource) details.appendChild(makeElement('small', '', `${String(offer.provenance || 'source record').replace(/_/g, ' ')}${offer.externalSource ? ` · ${String(offer.externalSource)}` : ''}`));
        const actions = makeElement('div', 'storefront-offer-actions');
        const button = makeElement('button', 'sf-btn sf-primary', 'Choose offer');
        button.type = 'button';
        button.addEventListener('click', () => { void startKnownOffer(String(offer.id || '')); });
        actions.appendChild(button);
        const cartButton = makeElement('button', 'sf-btn sf-secondary', 'Add to review cart');
        cartButton.type = 'button';
        cartButton.addEventListener('click', async () => { cartButton.disabled = true; try { const response = await fetch('/api/cart/items', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId: String(offer.id || ''), quantity: 1 }) }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.success) throw new Error(data.error || 'Could not add this offer to your review cart'); cartButton.textContent = 'Added to cart'; } catch (error) { cartButton.disabled = false; cartButton.textContent = error.message || 'Try again'; } });
        actions.appendChild(cartButton);
        if (offer.externalUrl) { const external = makeElement('button', 'sf-btn sf-secondary', `View on ${String(offer.externalSource || 'partner')}`); external.type = 'button'; external.addEventListener('click', async () => { await fetch('/api/cart/affiliate-click', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: String(offer.id || offer.description || '') }) }).catch(() => {}); window.open(String(offer.externalUrl), '_blank', 'noopener'); }); actions.appendChild(external); }
        item.append(details, actions);
        list.appendChild(item);
      });
      offers.appendChild(list);
      holder.appendChild(offers);
    }

    if (Array.isArray(card.deliveryCandidates) && card.deliveryCandidates.length) {
      const candidates = makeElement('section', 'storefront-delivery-candidates');
      candidates.appendChild(makeElement('strong', '', 'Delivery options'));
      const list = makeElement('ul', 'storefront-offers-list');
      card.deliveryCandidates.forEach(provider => {
        const item = makeElement('li');
        const details = makeElement('div');
        details.append(
          makeElement('strong', '', provider.name || 'Delivery provider'),
          makeElement('span', '', `Profile details · listed rate ${String(provider.hourly_rate || 0)} ${String(provider.currency || 'local currency')}`)
        );
        const button = makeElement('button', 'sf-btn sf-primary', 'Choose delivery');
        button.type = 'button';
        button.addEventListener('click', () => { void selectDeliveryCandidate(card.requestId, String(provider.phone || '')); });
        item.append(details, button);
        list.appendChild(item);
      });
      candidates.appendChild(list);
      holder.appendChild(candidates);
    }

    if (Array.isArray(card.providers) && card.providers.length) {
      const providers = makeElement('ul', 'storefront-providers');
      card.providers.forEach((provider, index) => {
        const item = makeElement('li', index === 0 ? 'top' : '');
        item.append(
          makeElement('strong', '', provider.name || 'Provider'),
          makeElement('span', '', `Profile details · listed rate ${String(provider.hourly_rate || 0)} ${String(provider.currency || 'local currency')}`)
        );
        providers.appendChild(item);
      });
      holder.appendChild(providers);
    }

    if (card.quote) {
      const quote = makeElement('div', 'storefront-quote', 'Quote: ');
      quote.appendChild(makeElement('strong', '', `${String(card.quote.amount_minor)} ${String(card.quote.currency || 'local currency')}`));
      holder.appendChild(quote);
    }

    if (card.offer && typeof card.offer === 'object') {
      const offer = makeElement('section', 'storefront-offer');
      offer.appendChild(makeElement('strong', '', 'Seller offer'));
      offer.appendChild(makeElement('p', '', String(card.offer.description || 'Offer details are unavailable.')));
      const price = Number(card.offer.priceMinor);
      const amount = Number.isInteger(price) ? `${price} ${String(card.offer.currency || 'NGN')}` : 'Price pending confirmation';
      offer.appendChild(makeElement('span', 'storefront-offer-price', `Listed item price: ${amount}`));
      if (card.offer.availabilityNote) offer.appendChild(makeElement('small', '', String(card.offer.availabilityNote)));
      holder.appendChild(offer);
    }

    if (Array.isArray(card.participants) && card.participants.length) {
      const coordination = makeElement('section', 'storefront-coordination');
      coordination.appendChild(makeElement('strong', '', 'Coordination participants'));
      const participants = makeElement('ul', 'storefront-participants');
      card.participants.forEach(participant => {
        const item = makeElement('li');
        const role = String(participant.role || 'participant').replace(/_/g, ' ');
        const status = String(participant.status || 'invited').replace(/_/g, ' ');
        item.append(
          makeElement('strong', '', role),
          makeElement('span', '', `${status} · ${String(participant.capability || 'coordination detail pending')}`)
        );
        participants.appendChild(item);
      });
      coordination.appendChild(participants);
      holder.appendChild(coordination);
    }

    if (card.execution && typeof card.execution === 'object') {
      const execution = makeElement('section', 'storefront-execution');
      execution.appendChild(makeElement('strong', '', 'Execution status'));
      execution.appendChild(makeElement('span', 'storefront-execution-status', String(card.execution.status || 'pending').replace(/_/g, ' ')));
      execution.appendChild(makeElement('small', '', `Connector: ${String(card.execution.connectorId || 'not specified')}`));
      if (card.execution.externalReference) execution.appendChild(makeElement('small', '', `Provider reference: ${String(card.execution.externalReference)}`));
      if (card.execution.failureReason) execution.appendChild(makeElement('small', 'storefront-execution-failure', `Dispatch failed: ${String(card.execution.failureReason)}. Manual confirmation is required.`));
      if (Array.isArray(card.execution.evidence) && card.execution.evidence.length) {
        const evidence = makeElement('ul', 'storefront-execution-evidence');
        card.execution.evidence.forEach(item => {
          const source = String(item.source || 'evidence').replace(/_/g, ' ');
          const state = String(item.verificationState || 'unverified').replace(/_/g, ' ');
          evidence.appendChild(makeElement('li', '', `${String(item.type || 'event')} · ${source} · ${state}`));
        });
        execution.appendChild(evidence);
      }
      holder.appendChild(execution);
    }

    const actions = Array.isArray(card.actions) ? card.actions : [];
    if (actions.length) {
      const actionGroup = makeElement('div', 'storefront-actions');
      actions.forEach(action => {
        const style = action.style === 'danger' ? 'danger' : action.style === 'secondary' ? 'secondary' : 'primary';
        const button = makeElement('button', `sf-btn sf-${style}`, action.label || action.id || 'Continue');
        button.type = 'button';
        button.dataset.sfAction = String(action.id || '');
        button.addEventListener('click', () => {
          const actionId = button.dataset.sfAction || '';
          const fields = collectStorefrontFields(holder);
          if (actionId === 'start' && !card.requestId) {
            sendMessage(`Continue with ${card.skill || 'this request'}`);
            return;
          }
          if (!card.requestId || !actionId) return;
          void advanceStorefront(card.requestId, actionId, fields, messageEl);
        });
        actionGroup.appendChild(button);
      });
      holder.appendChild(actionGroup);
    }

    if (card.escrowProtected !== false) holder.appendChild(makeElement('span', 'escrow-badge', '🔒 Escrow Protected'));

    holder.querySelectorAll('[data-storefront-field]').forEach(field => {
      field.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          holder.querySelector('.sf-btn.sf-primary')?.click();
        }
      });
    });

    messageEl.querySelector('.bubble').appendChild(holder);
    if (card.requestId) state.activeStorefrontId = card.requestId;
  }

  function renderAssistanceOutcome(card, messageEl) {
    const holder = makeElement('div', 'provider-card assistance-outcome-card');
    holder.dataset.assistanceMode = String(card.mode || 'information');
    holder.dataset.canonicalAction = String(card.canonicalAction || 'assistance.content.open');

    const head = makeElement('div', 'storefront-head');
    head.append(
      makeElement('strong', '', card.mode === 'support' ? 'Guidance from Kurukoo' : 'Useful guidance'),
      makeElement('span', 'storefront-stage', 'source attributed')
    );
    holder.appendChild(head);
    holder.appendChild(makeElement('p', 'storefront-offer-copy', card.mode === 'support'
      ? 'These sources may help explain the situation. They are not provider availability or execution evidence.'
      : 'These sources are attributed guidance. They are not provider recommendations or completion claims.'));

    const sources = Array.isArray(card.sources) ? card.sources : [];
    if (sources.length) {
      const list = makeElement('ul', 'storefront-offers-list assistance-source-list');
      sources.forEach(source => {
        const item = makeElement('li');
        const details = makeElement('div');
        details.append(
          makeElement('strong', '', String(source.title || 'Kurukoo source')),
          makeElement('span', '', String(source.excerpt || 'Open this attributed source for more context.')),
          makeElement('small', '', `${String(source.kind || 'source').replace(/_/g, ' ')} · ${String(source.provenance || 'attributed')}`)
        );
        const params = new URLSearchParams({
          prompt: `Review this ${String(source.kind || 'source')} with me`,
          ...(source.kind === 'topic' ? { topicSlug: String(source.id || '') } : { resourceSlug: String(source.id || '') }),
        });
        const open = makeElement('a', 'sf-btn sf-secondary', 'Open in Chat');
        open.href = `/chat?${params.toString()}`;
        open.dataset.chatAction = String(card.canonicalAction || 'assistance.content.open');
        open.dataset.sourceKind = String(source.kind || 'source');
        open.dataset.sourceId = String(source.id || '');
        open.setAttribute('aria-label', `Open ${String(source.title || 'source')} in Chat`);
        item.append(details, open);
        list.appendChild(item);
      });
      holder.appendChild(list);
    }

    const nextActions = Array.isArray(card.nextActions) ? card.nextActions : [];
    if (nextActions.length) {
      const actions = makeElement('div', 'storefront-actions');
      nextActions.forEach(action => {
        if (!action?.label || !action?.prompt) return;
        const button = makeElement('button', 'sf-btn sf-primary', String(action.label));
        button.type = 'button';
        button.dataset.chatAction = String(card.canonicalAction || 'assistance.content.open');
        button.dataset.actionId = String(action.id || 'continue_support');
        button.addEventListener('click', () => sendMessage(String(action.prompt)));
        actions.appendChild(button);
      });
      holder.appendChild(actions);
    }

    const truth = card.truth && typeof card.truth === 'object' ? card.truth : {};
    const truthLabel = truth.sourceAttributed === true && truth.noProviderClaim === true && truth.noExecutionClaim === true
      ? 'Attributed guidance · no provider or execution claim'
      : 'Source status requires review';
    holder.appendChild(makeElement('small', 'storefront-execution-status', truthLabel));
    messageEl.querySelector('.bubble')?.appendChild(holder);
  }

  function renderSuggestions(options, messageEl, sponsored = []) {
    if ((!Array.isArray(options) || !options.length) && (!Array.isArray(sponsored) || !sponsored.length)) return;
    const holder = document.createElement('div');
    holder.className = 'intent-suggestion-bar';
    holder.setAttribute('aria-label', 'Suggested next actions');

    if (Array.isArray(options)) {
      options.forEach(option => {
        const opt = typeof option === 'string' ? { label: option, prompt: option } : option;
        if (!opt?.label || !opt?.prompt) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggestion-btn';
        btn.textContent = opt.label;
        btn.addEventListener('click', () => sendMessage(opt.prompt));
        holder.appendChild(btn);
      });
    }

    if (Array.isArray(sponsored)) {
      sponsored.forEach(ad => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggestion-btn sponsored';
        btn.appendChild(makeElement('span', '', 'Sponsored'));
        btn.appendChild(makeElement('strong', '', ad.title));
        btn.addEventListener('click', () => sendMessage(ad.keyword || ad.title));
        holder.appendChild(btn);
      });
    }

    messageEl.appendChild(holder);
  }

  function renderCard(card, messageEl) {
    if (!card || !messageEl) return;
    if (card.type === 'assistance_outcome') return renderAssistanceOutcome(card, messageEl);
    if (card.type === 'agentic_storefront') {
      if (card.stage === 'slot_fill' || card.stage === 'intent_extraction') {
        const missing = (Array.isArray(card.fields) ? card.fields : []).filter(field => field?.required && !field.value).map(field => String(field.label || field.key || 'the next detail').toLowerCase());
        if (missing.length && input) input.placeholder = `Tell me ${missing[0]}…`;
        return renderSuggestions(card.suggestions, messageEl, card.sponsored);
      }
      renderAgenticStorefront(card, messageEl);
      return renderSuggestions(card.suggestions, messageEl, card.sponsored);
    }
    if (card.type === 'suggestions') return renderSuggestions(card.options, messageEl, card.sponsored);
    if (card.type === 'intent_suggestions') return renderSuggestions(card.suggestions, messageEl, card.sponsored);
    if (card.type === 'ai_metadata') return updateModelStatus(card);
    if (card.type === 'agent_brief') {
      const recoverBriefAction = item => {
        const existing = item?.action;
        if (existing?.canonicalAction && existing?.objectType && existing?.objectId) return existing;
        const stableRef = String(item?.stableRef || '');
        const match = stableRef.match(/^(economic_request|task|reminder|agent_goal|notification):(.+)$/);
        if (!match) return null;
        const [, objectType, objectId] = match;
        const canonicalActionByType = {
          economic_request: 'economic_request.open',
          task: 'task.open',
          reminder: 'reminder.open',
          agent_goal: 'agent.goal.review',
          notification: 'notification.open',
        };
        const canonicalAction = canonicalActionByType[objectType];
        return canonicalAction ? { id: `open_${objectType}`, label: objectType === 'agent_goal' ? 'Open objective' : 'Open update', canonicalAction, objectType, objectId } : null;
      };
      const holder = makeElement('section', 'provider-card agent-brief-card');
      holder.setAttribute('aria-label', 'Kurukoo brief');
      holder.appendChild(makeElement('strong', '', 'What matters now'));
      const list = makeElement('div', 'inspector-list');
      const items = Array.isArray(card.items) ? card.items.filter(item => item?.attention !== 'SILENT').slice(0, 6) : [];
      if (!items.length) list.appendChild(makeElement('div', 'deferred', 'No active items need attention.'));
      items.forEach(item => {
        const action = recoverBriefAction(item);
        const canResume = action?.canonicalAction && action?.objectType && action?.objectId;
        const row = makeElement(canResume ? 'button' : 'div', 'inspector-list-row');
        if (canResume) {
          row.type = 'button';
          row.setAttribute('aria-label', `${String(action.label || 'Open update')}: ${String(item.summary || 'Kurukoo update')}`);
          row.addEventListener('click', () => {
            state.canonicalContextAction = {
              type: 'resume_canonical_context',
              contextId: `agent_brief:${String(card.briefId || card.id || 'current')}:${String(item.stableRef || action.objectId)}`.slice(0, 180),
              conversationId: action.conversationId || state.conversationId || undefined,
              canonicalAction: String(action.canonicalAction),
              objectType: String(action.objectType),
              objectId: String(action.objectId),
            };
            const target = String(action.objectType || 'update').replaceAll('_', ' ');
            void sendMessage(`Open this ${target}.`);
          });
        }
        row.appendChild(makeElement('span', '', String(item.summary || 'Kurukoo update')));
        if (item.approvalRequired) row.appendChild(makeElement('small', '', 'Review required'));
        list.appendChild(row);
      });
      const followUp = makeElement('button', 'text-btn', 'Go through these updates');
      followUp.type = 'button';
      followUp.addEventListener('click', () => { if (input) { input.value = 'What have I got going on?'; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); } });
      holder.append(list, followUp, makeElement('span', 'escrow-badge', 'Updates are read-only. Any consequential action still requires the existing approval boundary.'));
      messageEl.querySelector('.bubble')?.appendChild(holder);
      return;
    }
    if (card.type === 'emergency') {
      const holder = makeElement('section', 'emergency-chat-card'); holder.setAttribute('aria-label', 'Emergency assistance');
      const heading = makeChildren('div', 'emergency-chat-card__heading', [makeIcon('safety', 'Emergency'), makeElement('strong', '', 'Emergency mode')]);
      const service = makeElement('p', 'emergency-chat-card__service', `${String(card.service?.serviceType || card.session?.serviceType || 'emergency')} · ${String(card.status || card.session?.dialState || 'unavailable').replaceAll('_', ' ')}`);
      const location = makeElement('p', 'emergency-chat-card__location', `Location: ${card.locationStatus === 'approximate' ? 'approximate location shared' : 'not known yet'}`);
      const truth = makeElement('p', 'emergency-chat-card__truth', 'Kurukoo is a coordination interface, not an emergency responder. Connection and dispatch are never claimed without evidence.');
      const actions = makeElement('div', 'emergency-chat-card__actions');
      (Array.isArray(card.actions) ? card.actions : []).forEach(action => { const button = makeElement(action.href ? 'a' : 'button', 'emergency-chat-card__action', action.label || action.id); if (action.href) { button.href = action.href; button.setAttribute('aria-label', action.label || action.id); } else { button.type = 'button'; button.addEventListener('click', () => { if (action.canonicalAction === 'emergency.end') sendMessage('Actually this is not an emergency anymore.'); else if (action.canonicalAction === 'emergency.location') sendMessage('I do not know exactly where I am. Help me share an approximate location.'); }); } actions.appendChild(button); });
      holder.append(heading, service, location, truth, actions); messageEl.querySelector('.bubble')?.appendChild(holder); return;
    }

    if (card.type === 'auth_otp_input' || card.type === 'auth_conversation') {
      const step = card.type === 'auth_otp_input' ? 'otp' : String(card.step || 'name');
      if (state.isGuest) setAuthComposerStep(step);
      return;
    }


    if (card.type === 'safety_contact_capture') {
      const holder = makeElement('div', 'safety-capture-card');
      const inner = makeElement('div', 'safety-capture-inner');
      const icon = makeElement('div', 'safety-capture-icon', '🛡️');
      const title = makeElement('strong', '', 'Add emergency contact');
      const desc = makeElement('p', '', `You're adding ${card.name} as a contact. Share their phone number in the chat to continue.`);
      const btn = makeElement('button', 'primary-btn', 'Manage contacts');
      btn.addEventListener('click', () => setInspectorOpen(true, 'safety-card'));

      inner.append(icon, title, desc, btn);
      holder.appendChild(inner);
      messageEl.querySelector('.bubble').appendChild(holder);
      loadSafety();
      return;
    }

    if (card.type === 'auth_gate' || card.type === 'auth_in_chat_start') {
      renderCard({ ...card, type: 'auth_conversation', step: card.step || 'name' }, messageEl);
      return;
    }

    const holder = document.createElement('div');
    holder.className = 'provider-card';
    if (card.type === 'ride_picker') {
      holder.appendChild(makeElement('strong', '', 'Describe a ride request'));
      const qa = makeElement('div', 'quick-actions');
      ['🚗 Okada', '🛺 Keke', '🚕 Taxi'].forEach(t => { const b = makeElement('button', '', t); b.type = 'button'; qa.appendChild(b); });
      holder.append(qa, makeElement('span', 'escrow-badge', 'Availability is confirmed in the request flow.'));
      holder.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => sendMessage(`${btn.textContent.trim()} ride`)));
    } else if (card.type === 'worker_match' || card.type === 'service_search') {
      holder.appendChild(makeElement('strong', '', card.category === 'food' ? 'Food request' : 'Service request'));
      holder.appendChild(makeElement('div', 'deferred', 'Kurukoo is assessing the request context for a supported path.'));
      holder.appendChild(makeElement('span', 'escrow-badge', 'Availability is confirmed before a next action is presented.'));
    } else if (card.type === 'nearby_radar') {
      holder.appendChild(makeElement('strong', '', 'Nearby context'));
      holder.appendChild(makeElement('div', 'deferred', 'Location-based information is shown only when relevant data is available.'));
    } else if (card.type === 'sports_search') {
      holder.appendChild(makeElement('strong', '', 'Sports network'));
      holder.appendChild(makeElement('div', 'deferred', 'Searching leagues, teams, matches and nearby play.'));
    } else if (card.type === 'event_coverage') {
      holder.appendChild(makeElement('strong', '', 'Event coverage request'));
      holder.appendChild(makeElement('div', 'deferred', 'Contributor participation and any resulting payment step require separate confirmation.'));
    } else if (card.type === 'security_booking') {
      holder.appendChild(makeElement('strong', '', 'Security-related request'));
      holder.appendChild(makeElement('span', 'escrow-badge', 'Provider suitability and availability require confirmation.'));
    } else if (card.type === 'reminder') {
      const reminder = card.reminder || {};
      const heading = document.createElement('strong');
      heading.textContent = 'Reminder saved';
      const detail = document.createElement('div');
      detail.className = 'deferred';
      const due = reminder.due_at ? new Date(reminder.due_at) : null;
      const dueText = due && !Number.isNaN(due.getTime()) ? ` for ${due.toLocaleString()}` : '';
      detail.textContent = reminder.title ? `${reminder.title}${dueText}.` : 'Your reminder is attached to this conversation.';
      const boundary = document.createElement('span');
      boundary.className = 'escrow-badge';
      boundary.textContent = 'This personal reminder does not create a provider request or payment step.';
      holder.append(heading, detail, boundary);
    } else if (card.type === 'provider_profile_setup') {
      holder.appendChild(makeElement('strong', '', 'Provider profile review'));
      const skill = String(card.skill || '').trim();
      const location = String(card.location || '').trim();
      holder.appendChild(makeElement('div', 'deferred', `Skill: ${skill || 'not specified'}${location ? ` · Location: ${location}` : ''}`));
      holder.appendChild(makeElement('span', 'escrow-badge', 'Review required. This does not publish availability, verification, pricing, matching, payment, or fulfilment.'));
      const confirm = makeElement('button', 'primary-btn', 'Confirm and save profile skill');
      confirm.type = 'button';
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        confirm.textContent = 'Saving…';
        try {
          const response = await fetch('/api/profile/update', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: skill ? [skill] : [], location: location || undefined, is_available: false }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.success) throw new Error(data.error || 'Could not save provider profile');
          confirm.textContent = 'Saved — availability remains off';
          holder.appendChild(makeElement('div', 'deferred', 'Profile skill saved. Turn availability on separately only when you are ready, and verification is still required before matching.'));
        } catch (error) {
          confirm.disabled = false;
          confirm.textContent = 'Confirm and save profile skill';
          holder.appendChild(makeElement('div', 'deferred', `Could not save profile: ${error.message || 'try again'}`));
        }
      });
      holder.appendChild(confirm);
    } else if (card.type === 'artist_booking') {
      holder.appendChild(makeElement('strong', '', 'Creator request'));
      holder.appendChild(makeElement('div', 'deferred', 'Availability and representation details require confirmation before a request can proceed.'));
      holder.appendChild(makeElement('span', 'escrow-badge', 'Payment availability is assessed separately.'));
    } else {
      holder.appendChild(makeElement('strong', '', card.category || card.type || 'Kurukoo action'));
    }
    messageEl.querySelector('.bubble').appendChild(holder);
  }

  async function uploadAttachment(file) {
    const allowed = /^(image\/(png|jpeg|webp|gif)|application\/pdf|video\/mp4|video\/webm)$/i.test(file.type || '');
    if (!allowed) throw new Error('Unsupported attachment type. Use an image, PDF or supported video.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Attachment is larger than the 25 MB chat limit.');
    const reader = new FileReader();
    const data = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const response = await fetch('/api/chat/attachments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ name: file.name, type: file.type || 'application/octet-stream', data }) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Attachment upload failed'); }
    return (await response.json()).attachment;
  }

  function pushAgentSurfaceToast(title, detail, needsResponse = false) {
    const region = $('chat-toast-region'); if (!region) return;
    const toast = makeElement('div', 'chat-toast chat-toast-agent');
    const copy = makeElement('div', 'chat-toast-copy'); copy.append(makeElement('strong', '', title || 'Kurukoo update'), makeElement('span', '', String(detail || '').slice(0, 360)));
    const close = makeElement('button', 'chat-toast-close'); close.type = 'button'; close.setAttribute('aria-label', 'Dismiss Kurukoo update'); close.title = 'Dismiss'; close.append(makeIcon('close', 'Dismiss')); close.addEventListener('click', () => toast.remove());
    if (needsResponse) toast.dataset.needsResponse = 'true';
    toast.append(makeIcon('agent', 'Kurukoo'), copy, close); region.appendChild(toast);
    setTimeout(() => toast.remove(), needsResponse ? 12000 : 7000);
  }
  function createBackgroundStreamBubble() {
    const wrap = makeElement('article', 'message assistant message-streaming'); wrap.hidden = true;
    const bubble = makeElement('div', 'bubble'); bubble.append(makeElement('div', 'thinking', 'Kurukoo is working…'), makeElement('div', 'markdown-body')); wrap.appendChild(bubble); return wrap;
  }
  function applyCapabilityResult(result, assistant) {
    if (!result) return;
    state.lastCapabilityResult = result;
    if (!assistant) return;
    assistant.dataset.capabilityStatus = String(result.status || 'accepted');
    if (result.canonicalObjectId) assistant.dataset.canonicalObjectId = String(result.canonicalObjectId);
    const bubble = assistant.querySelector('.bubble');
    if (!bubble || bubble.querySelector('.message-capability-status')) return;
    const labels = {
      accepted: 'Accepted', waiting: 'Waiting for the next supported step', needs_user: 'Needs your input', confirmation_required: 'Confirmation required',
      blocked: 'Blocked safely', failed: 'Needs recovery', completed: 'Completed', externally_pending: 'Pending external evidence', unavailable_external_dependency: 'External activation required',
    };
    const status = makeElement('div', 'message-capability-status', labels[result.status] || 'Capability status updated');
    status.dataset.capabilityStatus = String(result.status || 'accepted');
    status.setAttribute('role', 'status');
    bubble.appendChild(status);
  }
  async function sendMessage(raw) {
    const text = String(raw || input.value || '').trim(); if (!text || state.busy || !(await ensureIdentity())) return;
    const surfaceActive = Boolean(state.surfaceView);
    state.controller = new AbortController(); setComposerBusy(true); setConnection(true); input.value = ''; clearComposerDraft();
    let attachment = state.attached;
    try {
      if (attachment instanceof File) { input.placeholder = 'Uploading attachment…'; attachment = await uploadAttachment(attachment); }
      state.attached = null; $('attachment-preview').hidden = true; $('attachment-preview').textContent = '';
      const finalText = attachment ? `${text}\n\n[Attachment: ${attachment.name} — ${attachment.type} — ${attachment.url}]` : text;
      const contextAction = state.canonicalContextAction || state.discoveryContextAction || undefined; state.canonicalContextAction = null; state.discoveryContextAction = undefined;
      const user = surfaceActive ? document.createElement('article') : addUserMessage(finalText); const assistant = surfaceActive ? createBackgroundStreamBubble() : appendStreamBubble(); const output = assistant.querySelector('.markdown-body'); const thinking = assistant.querySelector('.thinking'); let full = ''; setTypingStatus('thinking');
      const response = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal: state.controller?.signal, body: JSON.stringify({ message: finalText, channel: 'web', conversationId: state.conversationId || undefined, attachment: attachment || undefined, contextAction }) });
      if (response.status === 401) { await ensureIdentity(); throw new Error('Your session has expired.'); }
      if (!response.ok || !response.body) throw new Error(`Chat request failed (${response.status})`);
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split('\n\n'); buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find(x => x.startsWith('data: ')); if (!line) continue; const payload = line.slice(6); if (payload === '[DONE]') continue;
          let data; try { data = JSON.parse(payload); } catch { continue; }
          if (data.type === 'conversation') { state.conversationId = data.conversationId; localStorage.setItem('kurukoo_conversation_id', state.conversationId); user.dataset.messageId = data.messageId || ''; }
          if (data.type === 'auth_success') {
            state.isGuest = false; state.authStep = 'none';
            setAuthComposerStep('none');
            setConnection(true);
            const logoutButton = $('workspace-logout') || $('logout-sidebar-btn'); if (logoutButton) logoutButton.hidden = false;
            if (data.phone) localStorage.setItem('kurukoo_user_phone', data.phone);
          }
          if (data.type === 'metadata') updateModelStatus(data);
          if (data.type === 'status') setTypingStatus(data.status, data.label);
          if (data.type === 'agent_goal') renderAgentGoal(data.goal, []);
          if (data.type === 'capability_result') applyCapabilityResult(data.result, assistant);
          if (data.type === 'thought' && thinking) thinking.hidden = false;
          if (data.type === 'text') {
            if (assistant.hidden) { assistant.hidden = false; assistant.classList.remove('message-streaming'); assistant.classList.add('message-arrived'); }
            setTypingStatus('complete'); full += data.content || ''; setMarkdown(output, full); enhanceCode(assistant); scroll.scrollTop = scroll.scrollHeight;
          }
          if (data.type === 'done') {
            setTypingStatus('complete');
            if (assistant.hidden) { assistant.hidden = false; assistant.classList.remove('message-streaming'); assistant.classList.add('message-arrived'); }

            assistant.dataset.messageId = data.messageId || '';
            setDeferredStatus(data.cardData);
            if (data.capabilityResult) applyCapabilityResult(data.capabilityResult, assistant);
            if (data.cardData && !surfaceActive) renderCard(data.cardData, assistant);
            if (surfaceActive) pushAgentSurfaceToast(data.cardData?.title || 'Kurukoo update', full || data.cardData?.message || 'Kurukoo has an update for this task.', Boolean(data.cardData?.fields?.length || data.cardData?.needsUser));
            if (data.cardData?.type === 'agentic_storefront' && data.cardData.requestId) state.activeStorefrontId = data.cardData.requestId;
          }
          if (data.type === 'error') throw new Error(data.error || 'Stream error');
        }
      }
      if (state.isGuest) {
        if (/enter your phone number/i.test(full)) setAuthComposerStep('phone');
        else if (/6-digit(?: verification)? code|code from the approved verification channel/i.test(full)) setAuthComposerStep('otp');
        else if (/profile is now verified|account is now connected/i.test(full)) setAuthComposerStep('none');
      }
      state.messages.push({ role: 'user', text: finalText, id: Number(user.dataset.messageId) || null }); state.messages.push({ role: 'assistant', text: full, id: Number(assistant.dataset.messageId) || null });
      if (!full) output.textContent = 'I could not complete that request. Please try again.';
      await refreshHistory();
    } catch (error) {
      if (error?.name === 'AbortError') { setConnection(true); setTypingStatus('complete'); assistant.hidden = false; assistant.classList.remove('message-streaming'); assistant.classList.add('message-arrived'); if (!full) setMarkdown(output, 'Generation stopped.'); return; }
      setConnection(false, 'Connection issue'); setTypingStatus('error'); if (!surfaceActive) { assistant.hidden = false; assistant.classList.remove('message-streaming'); assistant.classList.add('message-arrived'); }
      if (surfaceActive) pushAgentSurfaceToast('Kurukoo could not finish that', error.message || 'Please try again from the composer.', true);
      const bubble = surfaceActive ? null : chatContent.querySelector('.message.assistant:last-child .markdown-body');
      if (bubble) setMarkdown(bubble, `I’m having trouble completing that right now. **Please try again.**\n\n_${escapeAttr(error.message)}_`);
    } finally { state.controller = null; setTypingStatus('complete'); setComposerBusy(false); if (state.authStep !== 'none') setAuthComposerStep(state.authStep); else input.placeholder = state.displayName ? 'Tell Kurukoo what you need…' : 'Tell Kurukoo what you need…'; input.focus(); loadPoints(); loadReminders(); loadSafety(); loadAgentGoal(); }
  }

  function updateModelStatus(data) { const label = $('model-badge'); if (label && data.model) label.textContent = data.model; }
  async function loadPoints() { try { const res = await fetch('/api/points/balance', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const points = Number(data.points || 0); const balance = $('points-balance')?.querySelector('span'); if (balance) balance.textContent = points; const ip = $('inspector-points'); if (ip) ip.textContent = points; } catch {} }
  function renderNotifications(notifications = []) {
    const list = $('notifications-list'); const summary = $('notifications-summary');
    if (list) list.replaceChildren();
    const items = Array.isArray(notifications) ? notifications : [];
    const unreadItems = items.filter(item => item?.status === 'unread');
    const unread = unreadItems.length;
    const toastRegion = $('chat-toast-region');
    unreadItems.filter(item => item?.id && !state.notifiedNotificationIds.has(item.id)).slice(0, 3).forEach(item => { state.notifiedNotificationIds.add(item.id); if (!toastRegion) return; const toast = makeElement('div', 'chat-toast'); toast.append(makeIcon('alert', 'Notification'), makeElement('div', '', `${String(item.title || 'Kurukoo update')}\n${String(item.body || '')}`)); toastRegion.appendChild(toast); setTimeout(() => toast.remove(), 5200); });
    const badge = $('notification-badge');
    if (badge) { badge.textContent = unread > 99 ? '99+' : String(unread); badge.hidden = unread === 0; }
    if (summary) summary.textContent = unread ? `${unread} unread notification${unread === 1 ? '' : 's'} in your internal Kurukoo inbox.` : 'Your internal Kurukoo inbox is up to date.';
    if (!list) return;
    if (!items.length) { list.appendChild(makeElement('div', 'empty-state', 'No notifications yet.')); return; }
    items.forEach(item => {
      const row = makeElement('div', 'notification-list-item');
      row.dataset.status = String(item.status || 'read');
      const title = makeElement('strong', '', String(item.title || 'Kurukoo update'));
      const body = makeElement('span', '', String(item.body || ''));
      const meta = makeElement('small', '', `${String(item.delivery_state || 'queued')} · ${String(item.created_at || '')}`);
      row.append(title, body, meta);
      if (item.status === 'unread') {
        const read = makeElement('button', 'text-btn', 'Mark read'); read.type = 'button';
        read.addEventListener('click', async () => {
          read.disabled = true;
          try {
            await executeCanonicalAction('notification', 'dismiss', item.id);
            await loadNotifications();
          } catch { read.disabled = false; }
        });
        row.appendChild(read);
      }
      list.appendChild(row);
    });
  }
  function renderTasksActivity(topics = []) {
    const list = document.querySelector('[data-topics-activity]');
    const status = document.querySelector('[data-tasks-activity-status]');
    if (!list) return;
    list.replaceChildren();
    const items = Array.isArray(topics) ? topics.filter((topic) => topic && topic.title) .slice(0, 5) : [];
    if (status) status.textContent = items.length ? `${items.length} recent` : 'No new activity';
    if (!items.length) {
      const empty = makeElement('div', 'empty-workspace compact');
      empty.append(makeElement('p', 'topic-activity-empty', 'No recent public Topics match this view yet.'));
      list.appendChild(empty);
      return;
    }
    items.forEach((topic) => {
      const row = makeElement('article', 'topic-activity-item');
      const meta = makeElement('div', 'topic-activity-meta', [String(topic.type || 'Topic').replace(/_/g, ' '), topic.city || topic.lga || 'Community'].filter(Boolean).join(' · '));
      const title = makeElement('h3', 'topic-activity-title', String(topic.title));
      const body = makeElement('p', 'topic-activity-body', String(topic.body || 'Community Topic').slice(0, 150));
      const link = makeElement('button', 'workspace-text-action topic-activity-link', 'Open Topic');
      link.type = 'button'; link.dataset.topicSlug = String(topic.slug || '');
      link.addEventListener('click', () => { if (topic.slug) window.location.href = `/topics/${encodeURIComponent(topic.slug)}`; });
      row.append(meta, title, body, link); list.appendChild(row);
    });
  }
  async function loadTasksActivity() {
    if (!document.querySelector('[data-topics-activity]')) return;
    try {
      const url = new URL('/api/topics', location.origin); url.searchParams.set('limit', '5');
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Topics unavailable');
      const data = await response.json(); renderTasksActivity(data.topics || []);
    } catch { renderTasksActivity([]); }
  }
  function renderProactiveInspector(opportunities = []) {
    const card = document.getElementById('proactive-context-card'); const list = document.getElementById('proactive-context-list');
    if (!card || !list) return;
    const items = Array.isArray(opportunities) ? opportunities.filter((item) => item && item.title && item.status !== 'dismissed').slice(0, 3) : [];
    list.replaceChildren(); card.hidden = !items.length;
    items.forEach((item) => {
      const row = makeElement('article', 'proactive-context-item');
      row.append(makeElement('strong', 'proactive-context-title', String(item.title)), makeElement('p', 'proactive-context-copy', String(item.subtitle || 'Available in Chat.').slice(0, 130)));
      const action = makeElement('button', 'workspace-text-action proactive-context-action', String(item.ctaText || 'Open in Chat')); action.type = 'button';
      action.addEventListener('click', () => { const link = String(item.ctaLink || '/chat'); window.location.href = link.startsWith('/') ? link : '/chat'; });
      row.appendChild(action); list.appendChild(row);
    });
  }
  function renderNearbyInspector(features = [], active = false) {
    const list = document.getElementById('radar-list'); const label = document.getElementById('nearby-context-label');
    if (!list) return;
    if (label) label.textContent = active ? 'Happening now' : 'Nearby';
    list.replaceChildren();
    const items = Array.isArray(features) ? features.slice(0, 5) : [];
    if (!items.length) { list.appendChild(makeElement('div', 'empty-state', active ? 'No active activity is available in this area yet.' : 'Ask Kurukoo what is nearby when local discovery is useful.')); return; }
    items.forEach((feature) => {
      const props = feature?.properties || {};
      const row = makeElement('div', 'radar-list-item');
      const title = makeElement('strong', '', String(props.name || 'Nearby activity'));
      const detail = makeElement('small', '', String(props.detail || 'Activity data available'));
      row.append(title, detail); list.appendChild(row);
    });
  }
  async function loadNearbyInspector(view = state.surfaceView) {
    const list = document.getElementById('radar-list'); if (!list) return;
    if (view !== 'discover') { renderNearbyInspector([], false); return; }
    if (state.isGuest) { renderNearbyInspector([], true); const empty = list.querySelector('.empty-state'); if (empty) empty.textContent = 'Sign in to share your location for nearby results.'; return; }
    if (!navigator.geolocation) { renderNearbyInspector([], true); return; }
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 2500, maximumAge: 300000 }));
      const { latitude, longitude } = position.coords;
      const coarseLatitude = Math.round(latitude * 100) / 100;
      const coarseLongitude = Math.round(longitude * 100) / 100;
      const consentExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await fetch('/api/location/consent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'nearby_discovery', precision: 'coarse', latitude: coarseLatitude, longitude: coarseLongitude, expiresAt: consentExpiresAt }) }).catch(() => {});
      const url = new URL('/api/discover/map', location.origin); url.searchParams.set('lat', String(coarseLatitude)); url.searchParams.set('lng', String(coarseLongitude)); url.searchParams.set('radius', '10000'); url.searchParams.set('layers', 'mobile,stationary,agents,emergency,deals,events');
      const response = await fetch(url, { credentials: 'same-origin' }); if (!response.ok) throw new Error('Nearby activity unavailable');
      const data = await response.json(); renderNearbyInspector(data.features || [], true);
    } catch { renderNearbyInspector([], true); }
  }
  async function loadProactiveInspector() {
    const card = document.getElementById('proactive-context-card'); if (!card) return;
    try { const response = await fetch('/api/proactive/feed', { credentials: 'same-origin' }); if (!response.ok) throw new Error('Proactive feed unavailable'); const data = await response.json(); renderProactiveInspector(data.opportunities || []); } catch { renderProactiveInspector([]); }
  }
  async function loadTaskContext() {
    const list = $('task-context-list'); if (!list) return;
    try {
      const res = await fetch('/api/tasks', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Unable to load tasks');
      const payload = await res.json();
      const tasks = Array.isArray(payload) ? payload : (Array.isArray(payload.tasks) ? payload.tasks : []);
      list.replaceChildren();
      if (!tasks.length) { list.appendChild(makeElement('div', 'empty-state', 'No pending tasks right now.')); return; }
      tasks.slice(0, 4).forEach(task => {
        const row = makeElement('div', 'task-context-row');
        const status = String(task.status || 'pending').replace(/_/g, ' ');
        const title = String(task.title || task.description || task.name || `Task #${task.id || '—'}`);
        row.append(makeElement('span', 'task-context-dot'), makeElement('span', 'task-context-copy', title), makeElement('small', 'task-context-status', status));
        list.appendChild(row);
      });
    } catch { list.replaceChildren(makeElement('div', 'empty-state', 'Tasks are unavailable right now.')); }
  }
  async function loadTrustChallenges() {
    if (state.isGuest) return;
    try {
      const response = await fetch('/api/device/challenges', { credentials: 'same-origin' });
      if (!response.ok) return;
      const data = await response.json();
      const challenges = Array.isArray(data.challenges) ? data.challenges : [];
      const toastRegion = $('chat-toast-region');
      challenges.filter(challenge => challenge?.id && !state.notifiedTrustChallengeIds.has(challenge.id)).forEach(challenge => {
        state.notifiedTrustChallengeIds.add(challenge.id);
        if (!toastRegion) return;
        const toast = makeElement('div', 'chat-toast chat-toast--approval');
        const copy = makeElement('div');
        copy.append(makeElement('strong', '', 'Approve this Kurukoo device'), makeElement('span', '', 'A new browser is asking to continue your account.'));
        const actions = makeElement('div', 'chat-toast-actions');
        const approve = makeElement('button', 'text-btn', 'Approve'); approve.type = 'button';
        const deny = makeElement('button', 'text-btn', 'Deny'); deny.type = 'button';
        const deviceId = localStorage.getItem('kurukoo_device_id') || '';
        const act = async (button, path) => {
          button.disabled = true;
          try {
            const result = await fetch(`/api/device/challenge/${encodeURIComponent(challenge.id)}/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'X-Kurukoo-Device-Id': deviceId } });
            if (!result.ok) throw new Error('This device is not eligible to approve the request.');
            toast.remove();
          } catch (error) { button.disabled = false; button.textContent = error.message || 'Try again'; }
        };
        approve.addEventListener('click', () => void act(approve, 'approve'));
        deny.addEventListener('click', () => void act(deny, 'deny'));
        actions.append(approve, deny); toast.append(makeIcon('safety', 'Device approval'), copy, actions); toastRegion.appendChild(toast);
      });
    } catch {}
  }
  async function loadNotifications() { try { const res = await fetch('/api/notifications?limit=20', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); renderNotifications(data.notifications || []); await loadTrustChallenges(); } catch {} }
  function personalizeQuickActions(profile = {}) {
    const location = String(profile.location || profile.primary_lga || '').trim();
    const preferences = profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};
    const goal = String(preferences.goal || profile.goal || '').toLowerCase();
    const actions = [
      { prompt: location ? `What is useful to know near ${location}?` : 'Help me find something nearby', label: location ? 'Explore nearby' : 'Explore nearby', icon: 'discover' },
      { prompt: goal.includes('provider') || goal.includes('work') ? 'Help me find work or a service opportunity' : 'I need something sourced', label: goal.includes('provider') || goal.includes('work') ? 'Find work' : 'Source something', icon: 'work' },
      { prompt: 'Set a reminder', label: 'Reminder', icon: 'reminder' },
      { prompt: 'Help me stay safe', label: 'Safety', icon: 'safety' },
      { prompt: 'I need to get somewhere', label: 'Get somewhere', icon: 'ride' },
    ];
    document.querySelectorAll('.quick-actions, .composer-quick-actions').forEach(root => {
      const buttons = Array.from(root.querySelectorAll('button[data-prompt]'));
      actions.forEach((action, index) => {
        const button = buttons[index]; if (!button) return;
        button.dataset.prompt = action.prompt; button.dataset.personalized = location || goal ? 'profile' : 'default';
        button.replaceChildren(makeIcon(action.icon, ''), document.createTextNode(action.label));
      });
    });
  }

  async function loadMemory() { try { const res = await fetch('/api/profile', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const profile = data.profile || {}; if (!state.displayName && profile.name) state.displayName = String(profile.name); const memoryStatus = $('sidebar-memory-status'); if (memoryStatus) memoryStatus.textContent = profile.location || profile.name ? 'In use' : 'Ready'; personalizeQuickActions(profile); const text = `Kurukoo remembers ${profile.location || 'your area'}${profile.primary_lga ? `, ${profile.primary_lga}` : ''}. Your Memory Profile remains attached to your account.`; const mc = $('memory-context'); if (mc) mc.textContent = text; const im = $('inspector-memory'); if (im) im.textContent = text; } catch {} }

  function renderAgentGoal(goal, events = []) {
    const card = $('agent-goal-card'); const status = $('agent-goal-status'); const summary = $('agent-goal-summary'); const list = $('agent-goal-events'); const pause = $('agent-goal-pause'); const cancel = $('agent-goal-cancel');
    if (!card || !status || !summary || !list || !pause || !cancel) return;
    if (!goal) { card.hidden = true; card.dataset.goalAvailable = 'false'; return; }
    card.hidden = false; card.dataset.goalAvailable = 'true'; card.dataset.goalId = String(goal.id || '');
    const goalStatus = String(goal.status || 'checking');
    status.textContent = goalStatus.replace(/_/g, ' ');
    summary.textContent = String(goal.summary || goal.objective || 'Kurukoo is checking the current objective.');
    list.replaceChildren();
    (Array.isArray(events) ? events.slice(-4) : []).forEach(event => {
      const row = makeElement('div', 'agent-goal-event');
      row.textContent = `${String(event.result || 'update').replace(/_/g, ' ')} · ${String(event.detail || event.action || '').slice(0, 180)}`;
      list.appendChild(row);
    });
    if (!list.childElementCount) list.appendChild(makeElement('div', 'empty-state', 'Kurukoo will show confirmed activity here.'));
    const stoppable = ['active', 'waiting', 'needs_user', 'blocked'].includes(goalStatus);
    const paused = goalStatus === 'waiting' && String(goal.summary || '').toLowerCase().startsWith('paused at your request');
    pause.hidden = !stoppable;
    pause.textContent = paused ? 'Resume' : 'Pause';
    cancel.hidden = !stoppable;
    const submitGoalAction = async (action, failureMessage) => {
      if (!goal.id) return;
      pause.disabled = true; cancel.disabled = true;
      try {
        const result = await executeCanonicalAction('agent', action, goal.id);
        renderAgentGoal({ id: goal.id, status: result.canonicalFacts?.status || (action === 'pause' ? 'waiting' : action === 'cancel' ? 'cancelled' : 'active'), summary: result.canonicalFacts?.objective || goal.summary }, events);
      } catch (error) { setInspectorFeedback(error.message || failureMessage, 'error'); }
      finally { pause.disabled = false; cancel.disabled = false; }
    };
    pause.onclick = () => submitGoalAction(paused ? 'resume' : 'pause', paused ? 'Could not resume follow-up.' : 'Could not pause follow-up.');
    cancel.onclick = () => submitGoalAction('cancel', 'Could not stop follow-up.');
  }

  async function loadAgentGoal() {
    try {
      const url = new URL('/api/agent/timeline', location.origin); if (state.conversationId) url.searchParams.set('conversationId', state.conversationId);
      const response = await fetch(url, { credentials: 'same-origin' }); if (!response.ok) { renderAgentGoal(null); return; }
      const data = await response.json(); renderAgentGoal(data.goal, data.events);
    } catch { renderAgentGoal(null); }
  }

  async function loadReminders() {
    try {
      const res = await fetch('/api/reminders', { credentials: 'same-origin' });
      const card = $('reminders-card'); const list = $('reminder-list');
      if (!res.ok || !card || !list) return;
      const data = await res.json(); const reminders = Array.isArray(data.reminders) ? data.reminders : []; state.nativeAssistance.reminders = reminders; updateNativeAssistanceStatus();
      card.hidden = false; list.replaceChildren();
      if (!reminders.length) { list.textContent = 'No active reminders.'; return; }
      reminders.forEach(reminder => {
        const row = document.createElement('div'); row.className = 'reminder-list-item';
        const title = document.createElement('strong'); title.textContent = String(reminder.title || 'Reminder');
        const due = document.createElement('span'); const parsed = reminder.due_at ? new Date(reminder.due_at) : null;
        due.textContent = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString() : 'Scheduled time unavailable';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'text-btn'; cancel.textContent = 'Cancel';
        cancel.addEventListener('click', async () => { cancel.disabled = true; try { await executeCanonicalAction('reminder', 'cancel', reminder.id); } catch (error) { setInspectorFeedback(error.message || 'Could not cancel reminder.', 'error'); } finally { loadReminders(); } });
        row.append(title, due, cancel); list.appendChild(row);
      });
    } catch {}
  }

  function setInspectorFeedback(message, kind = 'info') { const feedback = $('inspector-feedback'); if (!feedback) return; feedback.hidden = !message; feedback.textContent = message || ''; feedback.dataset.kind = kind; }
  async function executeCanonicalAction(capability, action, canonicalObjectId, args = {}) {
    if (state.isGuest) throw new Error('Sign in before changing account-owned state.');
    const idempotencyKey = `chat:${state.conversationId || 'draft'}:${capability}:${action}:${canonicalObjectId || 'none'}:${JSON.stringify(args).slice(0, 120)}`.slice(0, 180);
    const response = await fetch('/api/chat/action', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capability, action, canonicalObjectId: canonicalObjectId == null ? undefined : String(canonicalObjectId), arguments: args, conversationId: state.conversationId || undefined, idempotencyKey }) });
    let data = {}; try { data = await response.json(); } catch {}
    if (response.status === 401) { await ensureIdentity(); throw new Error('Session expired'); }
    if (!response.ok || !data.success) throw new Error(data.error || data.result?.message || 'Canonical action could not be completed.');
    return data.result;
  }
  async function nativeAction(url, options = {}) { const response = await fetch(url, { credentials: 'same-origin', ...options }); let data = {}; try { data = await response.json(); } catch {} if (!response.ok) throw new Error(data.error || 'Action could not be completed.'); return data; }

  async function loadSafety() {
    try {
      const [contactsResponse, checkInsResponse] = await Promise.all([
        fetch('/api/safety/contacts', { credentials: 'same-origin' }),
        fetch('/api/safety/check-ins', { credentials: 'same-origin' }),
      ]);
      const card = $('safety-card'); const contactsList = $('safety-contact-list'); const checkInsList = $('safety-checkin-list');
      if (!contactsResponse.ok || !checkInsResponse.ok || !card || !contactsList || !checkInsList) return;
      const contactsData = await contactsResponse.json(); const checkInsData = await checkInsResponse.json();
      const contacts = Array.isArray(contactsData.contacts) ? contactsData.contacts : [];
      const checkIns = Array.isArray(checkInsData.checkIns) ? checkInsData.checkIns : [];
      state.nativeAssistance.checkIns = checkIns; updateNativeAssistanceStatus();
      card.hidden = false; contactsList.replaceChildren(); checkInsList.replaceChildren();

      const contactHeading = document.createElement('strong'); contactHeading.textContent = contacts.length ? 'Contacts' : 'No safety contacts yet.'; contactsList.appendChild(contactHeading);
      contacts.forEach(contact => {
        const row = document.createElement('div'); row.className = 'safety-list-item';
        const label = document.createElement('span'); label.textContent = `${contact.name} · ${contact.status}`; row.appendChild(label);
        if (contact.status === 'pending') {
          const activate = document.createElement('button'); activate.type = 'button'; activate.className = 'text-btn'; activate.textContent = 'Activate';
          activate.addEventListener('click', async () => { activate.disabled = true; try { await nativeAction(`/api/safety/contacts/${encodeURIComponent(contact.id)}/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consentConfirmed: true }) }); await loadSafety(); } catch (e) { setInspectorFeedback(e.message, 'error'); } });
          row.appendChild(activate);
        }
        if (contact.status !== 'revoked') {
          const revoke = document.createElement('button'); revoke.type = 'button'; revoke.className = 'text-btn text-btn-danger'; revoke.textContent = 'Revoke';
          revoke.addEventListener('click', async () => { revoke.disabled = true; try { await nativeAction(`/api/safety/contacts/${encodeURIComponent(contact.id)}/revoke`, { method: 'POST' }); await loadSafety(); } catch (e) { setInspectorFeedback(e.message, 'error'); revoke.disabled = false; } });
          row.appendChild(revoke);
        }
        contactsList.appendChild(row);
      });
    } catch {}
  }

  async function refreshHistory() {
    loadPinnedMessages();
    try {
      const url = new URL('/api/chat/history', location.origin); if (state.conversationId) url.searchParams.set('conversationId', state.conversationId); url.searchParams.set('limit', '60');
      const res = await fetch(url, { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); if (data.messages?.length) state.messages = data.messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.content, id: m.id })); const list = $('history-list'); if (!list) return; list.replaceChildren();
      data.conversations.forEach(c => addHistoryItem(c, c.id === state.conversationId));
      if (!state.surfaceView && data.messages?.length && chatContent.querySelectorAll('.message').length === 0) renderMessages(data.messages);
    } catch { setConnection(false, 'Offline'); }
    loadAgentGoal();
  }

  async function reconcileHistoricalStorefrontCards(entries) {
    await Promise.all(entries.map(async ({ messageEl, cardData }) => {
      if (!cardData?.requestId || !messageEl?.querySelector('[data-storefront-field]')) return;
      try {
        const response = await fetch(`/api/chat/economic-requests/${encodeURIComponent(cardData.requestId)}`, { credentials: 'same-origin' });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        const status = String(data.request?.status || '');
        if (status && status !== 'requested') {
          markStorefrontStepSuperseded(messageEl, `Request is ${status.replace(/_/g, ' ')} — review the latest state below.`);
        }
      } catch {}
    }));
  }

  function renderMessages(messages) {
    chatContent.replaceChildren();
    const entries = [];
    messages.forEach(m => {
      let cardData = null;
      if (m.card_data) try { cardData = JSON.parse(m.card_data); } catch {}
      const messageEl = createMessage(m.sender === 'user' ? 'user' : 'assistant', m.content, m.id, cardData, false);
      entries.push({ messageEl, cardData });
    });
    void reconcileHistoricalStorefrontCards(entries);
  }

  document.addEventListener('click', event => { const action = event.target.closest('[data-surface-view]'); if (action && action.dataset.surfaceWired !== '1') { event.preventDefault(); renderWorkspaceSurface(action.dataset.surfaceView); } });
  wireSurfaceActions();

  function setInspectorOpen(open, target = null) {
    const inspector = $('chat-inspector'); if (!inspector) return;
    if (open && inspector.classList.contains('is-collapsed')) setInspectorCollapsed(false);
    inspector.classList.toggle('open', open);
    $('memory-toggle')?.setAttribute('aria-expanded', String(open));
    $('notification-toggle')?.setAttribute('aria-expanded', String(open && target === 'notifications-card'));
    if (target) {
      inspector.querySelectorAll('.inspector-card').forEach(card => card.hidden = true);
      const targetCard = $(target); if (targetCard) targetCard.hidden = false;
    } else if (open) {
      inspector.querySelectorAll('.inspector-card').forEach(card => card.hidden = false);
    }
    localStorage.setItem('kurukoo_chat_inspector_open', open ? '1' : '0');
  }

  $('memory-toggle')?.addEventListener('click', () => setInspectorOpen(!$('chat-inspector')?.classList.contains('open')));
  $('notification-toggle')?.addEventListener('click', async () => { await loadNotifications(); $('notification-toggle')?.setAttribute('aria-expanded', 'false'); });
  $('close-inspector')?.addEventListener('click', () => setInspectorOpen(false));

  function setInspectorCollapsed(collapsed) {
    const inspector = $('chat-inspector'); const button = $('inspector-collapse');
    if (!inspector || !button) return;
    inspector.classList.toggle('is-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expand context panel' : 'Collapse context panel');
    button.title = collapsed ? 'Expand context panel' : 'Collapse context panel';
    localStorage.setItem('kurukoo_chat_inspector_collapsed', collapsed ? '1' : '0');
  }
  $('inspector-collapse')?.addEventListener('click', () => setInspectorCollapsed(!$('chat-inspector')?.classList.contains('is-collapsed')));
  setInspectorCollapsed(localStorage.getItem('kurukoo_chat_inspector_collapsed') === '1');

  function closeOverflowMenu() {
    const menu = $('chat-overflow-menu'); const toggle = $('chat-overflow-toggle');
    if (!menu || !toggle) return;
    menu.hidden = true; toggle.setAttribute('aria-expanded', 'false');
  }
  function openOverflowMenu() {
    const menu = $('chat-overflow-menu'); const toggle = $('chat-overflow-toggle');
    if (!menu || !toggle) return;
    menu.hidden = false; toggle.setAttribute('aria-expanded', 'true');
    menu.querySelector('[role="menuitem"]')?.focus();
  }
  async function deleteCurrentConversation() {
    if (state.isGuest) { alert('Please sign in to delete conversations.'); return; }
    if (!state.conversationId) { setInspectorFeedback('There is no saved conversation to delete.', 'info'); return; }
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    const conversationId = state.conversationId;
    try {
      const response = await fetch(`/api/chat/conversation/${encodeURIComponent(conversationId)}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to delete conversation.');
      localStorage.removeItem(`kurukoo_pins_${conversationId}`);
      localStorage.removeItem('kurukoo_conversation_id');
      state.conversationId = ''; state.messages = []; state.pinnedMessages = []; state.activeStorefrontId = null;
      chatContent.replaceChildren(); renderWelcome(); loadPinnedMessages(); refreshHistory();
      setInspectorOpen(false); setInspectorFeedback('Conversation deleted.', 'info');
    } catch (error) { setInspectorFeedback(error.message || 'Unable to delete conversation.', 'error'); }
  }
  function pinLatestConversationMessage() {
    const latest = [...state.messages].reverse().find(message => message && message.text);
    if (!latest) { setInspectorOpen(true); setInspectorFeedback('There is no message to pin yet.', 'info'); return; }
    const key = latest.id ? `message-${latest.id}` : `local-${state.messages.indexOf(latest)}`;
    togglePinnedMessage(key, { role: latest.role, text: latest.text });
    setInspectorOpen(true);
    $('pinned-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('chat-overflow-toggle')?.addEventListener('click', () => {
    const menu = $('chat-overflow-menu');
    if (menu?.hidden) openOverflowMenu(); else closeOverflowMenu();
  });
  $('chat-overflow-menu')?.addEventListener('click', event => {
    const item = event.target.closest('[role="menuitem"]'); if (!item) return;
    const action = item.dataset.overflowAction;
    if (action === 'delete') void deleteCurrentConversation();
    if (action === 'pin') pinLatestConversationMessage();
    closeOverflowMenu();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.chat-overflow-wrap')) closeOverflowMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeOverflowMenu(); });
  if (localStorage.getItem('kurukoo_chat_inspector_open') === '1') setInspectorOpen(true);

  const wireQuickActions = (root) => {
    root.querySelectorAll('button[data-prompt]').forEach(btn => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
    });
  };

  document.addEventListener('kurukoo:qr', event => {
    const detail = event.detail || {};
    if (!detail.conversationId || !detail.intro) return;
    state.conversationId = detail.conversationId;
    localStorage.setItem('kurukoo_conversation_id', state.conversationId);
    $('welcome')?.remove();
    state.messages.push({ role: 'assistant', text: detail.intro, id: detail.messageId || null });
    createMessage('assistant', detail.intro, detail.messageId || null);
    refreshHistory();
  });

  document.addEventListener('kurukoo:voice', event => {
    const detail = event.detail || {};
    if (detail.type === 'conversation' && detail.conversationId) {
      state.conversationId = detail.conversationId;
      localStorage.setItem('kurukoo_conversation_id', state.conversationId);
      loadPinnedMessages();
      return;
    }
    if (detail.type === 'transcript' && detail.text) {
      $('welcome')?.remove();
      const role = detail.role === 'assistant' ? 'assistant' : 'user';
      state.messages.push({ role, text: detail.text, id: detail.messageId || null });
      createMessage(role, detail.text, detail.messageId || null);
      return;
    }
    if (detail.type === 'card' && detail.cardData) {
      const target = chatContent.querySelector('.message.assistant:last-child');
      if (target) renderCard(detail.cardData, target);
    }
  });

  function renderAttachmentPreview(file) {
    const preview = $('attachment-preview'); if (!preview) return;
    preview.replaceChildren();
    if (!file) { preview.hidden = true; return; }
    preview.hidden = false;
    preview.appendChild(makeIcon('attach', 'Attachment'));
    const details = makeElement('span'); details.className = 'attachment-name'; details.textContent = file.name;
    const meta = makeElement('span', 'attachment-meta', `${file.type || 'file'} · ${Math.max(1, Math.round(file.size / 1024))} KB`);
    const remove = makeElement('button', 'attachment-remove'); remove.type = 'button'; remove.setAttribute('aria-label', 'Remove attachment'); remove.title = 'Remove attachment'; remove.appendChild(makeIcon('close', 'Remove attachment'));
    remove.addEventListener('click', () => { state.attached = null; if ($('file-input')) $('file-input').value = ''; renderAttachmentPreview(null); });
    preview.append(details, meta, remove);
  }
  $('attach-file')?.addEventListener('click', () => $('file-input')?.click());
  $('file-input')?.addEventListener('change', event => { const file = event.target.files?.[0]; state.attached = file || null; renderAttachmentPreview(state.attached); });
  input?.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 180)}px`; if (!state.busy && send) send.disabled = !input.value.trim(); saveComposerDraft(); });
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  send?.addEventListener('click', () => sendMessage());
  stop?.addEventListener('click', () => { state.controller?.abort(); });
  $('new-chat')?.addEventListener('click', async () => {
    if (!await ensureIdentity()) return;
    try {
      const res = await fetch('/api/chat/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ channel: 'web', title: 'New conversation' }) });
      const data = await res.json();
      if (data.conversationId) { state.conversationId = data.conversationId; localStorage.setItem('kurukoo_conversation_id', data.conversationId); }
    } catch {}
    state.messages = []; state.activeStorefrontId = null; chatContent.replaceChildren();
    const ds = $('deferred-status'); if (ds) ds.hidden = true;
    renderWelcome(); void loadAgentBrief(); refreshHistory();
  });

  $('surface-header-back')?.addEventListener('click', () => leaveWorkspaceSurface());
  $('logout-button')?.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    localStorage.removeItem('kurukoo_user_phone');
    localStorage.removeItem('kurukoo_user_name');
    window.location.assign('/');
  });

  function hydrateChatDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get('conversationId');
    const prompt = params.get('prompt');
    const providerSlug = params.get('providerSlug');
    const topicSlug = params.get('topicSlug');
    const resourceSlug = params.get('resourceSlug');
    const requestId = params.get('requestId');
    const discoveryEntityId = params.get('discoveryEntityId');
    const canonicalAction = params.get('canonicalAction');
    const objectType = params.get('objectType');
    const objectId = params.get('objectId');
    const contextId = params.get('contextId');
    if (conversationId) { state.conversationId = conversationId.slice(0, 160); localStorage.setItem('kurukoo_conversation_id', state.conversationId); }
    if (discoveryEntityId) state.discoveryContextAction = { type: 'open_discovery_entity', entityId: discoveryEntityId.slice(0, 180) };
    if (canonicalAction && objectType && objectId) state.canonicalContextAction = { type: 'resume_canonical_context', contextId: contextId?.slice(0, 180), conversationId: conversationId?.slice(0, 180), canonicalAction: canonicalAction.slice(0, 120), objectType: objectType.slice(0, 80), objectId: objectId.slice(0, 180) };
    const contextParts = [];
    if (providerSlug) contextParts.push(`Provider context: ${providerSlug}`);
    if (topicSlug) contextParts.push(`Topic context: ${topicSlug}`);
    if (resourceSlug) contextParts.push(`Resource context: ${resourceSlug}`);
    if (requestId) contextParts.push(`Request context: ${requestId}`);
    if (discoveryEntityId) contextParts.push(`Discovery context: ${discoveryEntityId}`);
    const contextBanner = $('qr-context-banner');
    if (contextBanner && contextParts.length) { contextBanner.textContent = `${contextParts.join(' · ')}. Kurukoo will keep this context with the conversation.`; contextBanner.hidden = false; }
    if (prompt && input) { input.value = prompt.slice(0, 12000); input.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  async function loadAgentBrief() {
    try {
      const response = await fetch('/api/agent/brief', { credentials: 'same-origin' });
      if (!response.ok) return;
      const data = await response.json(); const brief = data?.brief;
      if (!brief?.id || state.lastAgentBriefId === brief.id) return;
      state.lastAgentBriefId = brief.id;
      window.KurukooAgentPresence?.set?.(brief.presence || 'idle', 'agent-brief');
      const visible = Array.isArray(brief.items) ? brief.items.filter(item => item?.attention !== 'SILENT') : [];
      if (!visible.length) return;
      const storageKey = `kurukoo_agent_brief_seen_${brief.id}`;
      if (sessionStorage.getItem(storageKey) === '1') return;
      sessionStorage.setItem(storageKey, '1');
      const message = createMessage('assistant', String(brief.presentation?.text || 'Kurukoo has an update for you.'), null, null, false);
      renderCard({ type: 'agent_brief', ...brief }, message);
      state.messages.push({ role: 'assistant', text: String(brief.presentation?.text || ''), id: null });
      if (brief.presentation?.shouldSpeak) speakAssistantResponse(String(brief.presentation.text || ''), null);
      scroll.scrollTop = scroll.scrollHeight;
    } catch {}
  }

  function renderWelcome() {
    chatContent.replaceChildren();
    const greeting = state.isGuest
      ? 'Welcome to Kurukoo. I’m designed to help you directly, organise a reminder, keep you safe, or coordinate people and services to fulfil your request. Can I take your name?'
      : `Welcome back${state.displayName ? `, ${state.displayName}` : ''}. What would you like to get done today?`;
    createMessage('assistant', greeting, null, null, false);
    const qa = makeElement('div', 'quick-actions welcome-quick-actions'); qa.id = 'quick-actions';
    [['I need a ride request', 'Ride'], ['I have a food request', 'Food'], ['I need repair help', 'Repair'], ['I want to discuss a work request', 'Work']].forEach(([p, l]) => {
      const b = makeElement('button', '', l); b.dataset.prompt = p; qa.appendChild(b);
    });
    chatContent.appendChild(qa); wireQuickActions(qa);
    if (state.isGuest) { void startGuestAuth().then(step => renderWelcomeAuth(step)); }
    else setAuthComposerStep('none');
  }

  function applyWorkspaceIdentityState() {
    const privateViews = new Set(['requests', 'tasks', 'topup', 'subscription', 'memory', 'safety', 'settings', 'points', 'cart', 'saved', 'reminders']);
    document.querySelectorAll('[data-surface-view]').forEach(action => {
      const view = action.dataset.surfaceView || '';
      const privateView = privateViews.has(view);
      action.hidden = Boolean(state.isGuest && privateView);
      action.setAttribute('aria-hidden', String(Boolean(state.isGuest && privateView)));
    });
    const moreToggle = $('sidebar-more-toggle');
    if (moreToggle) moreToggle.hidden = Boolean(state.isGuest);
    const moreItems = $('sidebar-more-items');
    if (moreItems && state.isGuest) moreItems.hidden = true;
    const presence = $('sidebar-presence'); if (presence) presence.textContent = state.isGuest ? 'Guest' : 'Available';
    const memory = $('sidebar-memory-status'); if (memory) memory.textContent = state.isGuest ? 'Not connected' : 'In use';
    const channel = $('sidebar-channel-status'); if (channel) channel.textContent = state.isGuest ? 'Web only' : 'Web';
    const context = $('memory-context'); if (context) context.textContent = state.isGuest ? 'Start with a conversation. Your private context appears after you establish your account.' : 'Your conversations, reminders and saved context stay connected to your profile.';
  }

  async function registerCurrentDeviceTrust() {
    if (state.isGuest) return false;
    try {
      let deviceId = localStorage.getItem('kurukoo_device_id');
      if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('kurukoo_device_id', deviceId); }
      const response = await fetch('/api/device/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Kurukoo-Device-Id': deviceId },
        body: JSON.stringify({ deviceId, credentialType: 'web', label: 'Current Kurukoo browser', pushCapable: 'Notification' in window }),
      });
      return response.ok;
    } catch { return false; }
  }

  applyTheme();
  hydrateChatDeepLink();
  ensureIdentity().then(async ok => {
    applyWorkspaceIdentityState();
    if (ok) {
      await registerCurrentDeviceTrust();
      await refreshHistory();
      await Promise.all([loadPoints(), loadMemory(), loadNotifications(), loadTaskContext(), loadReminders(), loadSafety(), loadAgentGoal()]);
    loadProactiveInspector();
    loadNearbyInspector(state.surfaceView);
      if ($('welcome')) await loadAgentBrief();
    }
  });

})();
