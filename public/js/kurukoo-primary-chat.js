(() => {
  const state = {
    conversationId: localStorage.getItem('kurukoo_conversation_id') || '',
    messages: [], busy: false, attached: null,
    theme: localStorage.getItem('kurukoo_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    activeStorefrontId: null,
    nativeAssistance: { reminders: [], checkIns: [] },
    pinnedMessages: []
  };
  const $ = id => document.getElementById(id);
  const chatContent = $('chat-content'), scroll = $('chat-scroll'), input = $('message-input'), send = $('send-message');
  const pinStorageKey = () => `kurukoo_pins_${state.conversationId || 'draft'}`;
  function savePinnedMessages() { try { localStorage.setItem(pinStorageKey(), JSON.stringify(state.pinnedMessages)); } catch {} }
  function loadPinnedMessages() { try { const parsed = JSON.parse(localStorage.getItem(pinStorageKey()) || '[]'); state.pinnedMessages = Array.isArray(parsed) ? parsed.slice(0, 12) : []; } catch { state.pinnedMessages = []; } renderPinnedMessages(); }
  function renderPinnedMessages() { const card = $('pinned-card'), list = $('pinned-list'); if (!card || !list) return; card.hidden = false; list.replaceChildren(); if (!state.pinnedMessages.length) { list.appendChild(makeElement('p', 'empty-state', 'Long-press or right-click a message to pin it here.')); return; } state.pinnedMessages.forEach(pin => { const row = makeElement('div', 'pinned-message'); const reference = makeElement('button', 'pinned-message-reference', pin.text); reference.type = 'button'; reference.title = 'Jump to pinned message'; reference.addEventListener('click', () => { const target = chatContent.querySelector(`[data-pin-key="${CSS.escape(pin.key)}"]`); if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('message-pinned-focus'); setTimeout(() => target.classList.remove('message-pinned-focus'), 1200); } }); const remove = makeElement('button', 'text-btn', 'Unpin'); remove.type = 'button'; remove.addEventListener('click', () => togglePinnedMessage(pin.key)); row.append(reference, remove); list.appendChild(row); }); }
  function togglePinnedMessage(key, message = null) { const index = state.pinnedMessages.findIndex(pin => pin.key === key); if (index >= 0) state.pinnedMessages.splice(index, 1); else if (message) state.pinnedMessages.unshift({ key, role: message.role, text: String(message.text || '').slice(0, 280) }); else return; savePinnedMessages(); renderPinnedMessages(); }
  function wirePinGestures(wrap, role, text) { const key = wrap.dataset.pinKey || (wrap.dataset.messageId ? `message-${wrap.dataset.messageId}` : `local-${crypto.randomUUID()}`); wrap.dataset.pinKey = key; const toggle = () => togglePinnedMessage(key, { role, text }); let timer = null; wrap.addEventListener('contextmenu', event => { event.preventDefault(); toggle(); }); wrap.addEventListener('pointerdown', event => { if (event.pointerType !== 'touch' || event.target.closest('button,a,input,textarea')) return; timer = setTimeout(() => { timer = null; toggle(); }, 560); }); ['pointerup','pointercancel','pointerleave','pointermove'].forEach(type => wrap.addEventListener(type, () => { if (timer) { clearTimeout(timer); timer = null; } })); }

  
  const makeElement = (tag, className = '', text = '') => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  const makeIcon = (name, label = '') => {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'k-icon');
    icon.setAttribute('aria-hidden', label ? 'false' : 'true');
    if (label) icon.setAttribute('aria-label', label);
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `/icons/kurukoo-icons.svg#${name}`);
    icon.appendChild(use);
    return icon;
  };

  const makeBrandAvatar = () => {
    const avatar = makeElement('div', 'avatar');
    avatar.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.src = '/assets/brand/logo-icon.svg';
    image.alt = '';
    image.width = 20;
    avatar.appendChild(image);
    return avatar;
  };

  const setConnection = (ok, text = ok ? 'Connected' : 'Offline') => { 
    const el = $('connection-status'); 
    if (el) { 
      el.replaceChildren(makeElement('span', 'status-dot'), document.createTextNode(` ${text}`)); 
      el.classList.toggle('offline', !ok); 
    } 
  };

  function setTypingStatus(status = 'complete', label = '') {
    const active = status === 'typing' || status === 'thinking';
    let indicator = chatContent?.querySelector('[data-kurukoo-typing]');
    if (!active) { indicator?.remove(); return; }
    if (!indicator) {
      indicator = document.createElement('article');
      indicator.className = 'typing-indicator message assistant';
      indicator.dataset.kurukooTyping = 'true';
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      indicator.setAttribute('aria-atomic', 'true');
      const avatar = makeElement('div', 'avatar'); avatar.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img'); image.src = '/assets/brand/logo-icon.svg'; image.alt = ''; image.width = 20;
      avatar.appendChild(image);
      const bubble = makeElement('div', 'bubble typing-indicator-bubble');
      const text = makeElement('span', 'typing-indicator-label');
      const dots = makeElement('span', 'typing-indicator-dots'); dots.setAttribute('aria-hidden', 'true');
      dots.append(makeElement('i'), makeElement('i'), makeElement('i'));
      bubble.append(text, dots); indicator.append(avatar, bubble); chatContent?.appendChild(indicator);
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
    
    const avatar = makeBrandAvatar();
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
      setConnection(true);
      state.isGuest = false;
      return true;
    }

    if (sessionCheck?.status === 401) {
      state.isGuest = true;
      setConnection(true, 'Guest Mode');
      return true;
    }

    setConnection(false, 'Offline');
    return false;
  }

  function addHistoryItem(conversation, active = false) {
    const list = $('history-list'); if (!list || !conversation?.id) return;
    let item = list.querySelector(`[data-conversation-id="${CSS.escape(conversation.id)}"]`);
    if (!item) { 
      item = document.createElement('button'); item.type = 'button'; item.className = 'history-item'; 
      item.dataset.conversationId = conversation.id; item.textContent = conversation.title || 'New conversation'; 
      item.addEventListener('click', () => loadConversation(conversation.id)); 
      list.appendChild(item); 
    }
    item.classList.toggle('active', active);
  }

  async function submitPilotFeedback(wrap, rating) {
    if (!wrap || wrap.dataset.feedbackSubmitted === 'true') return;
    const buttons = [...wrap.querySelectorAll('[data-feedback-rating]')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      const response = await fetch('/api/pilot/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ rating, conversationId: state.conversationId || null, messageId: wrap.dataset.messageId ? Number(wrap.dataset.messageId) : null, requestId: state.activeStorefrontId || null, channel: state.channel || 'web' }),
      });
      if (!response.ok) throw new Error('feedback unavailable');
      wrap.dataset.feedbackSubmitted = 'true';
      const selected = wrap.querySelector(`[data-feedback-rating="${rating}"]`); selected?.classList.add('selected');
    } catch {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function createMessage(role, text = '', id = null, cardData = null, animate = true) {
    const wrap = document.createElement('article'); wrap.className = `message ${role}`; wrap.dataset.messageState = animate ? 'incoming' : 'history'; if (animate) wrap.classList.add('message-enter'); if (id) wrap.dataset.messageId = id;
    
    const avatarDiv = makeElement('div', 'avatar'); avatarDiv.setAttribute('aria-hidden', 'true');
    if (role === 'assistant') {
      const img = document.createElement('img'); img.src = '/assets/brand/logo-icon.svg'; img.alt = ''; img.width = 20;
      avatarDiv.appendChild(img);
    }
    
    const body = makeElement('div', 'message-body');
    const bubble = makeElement('div', 'bubble');
    const md = makeElement('div', 'markdown-body');
    setMarkdown(md, text);
    bubble.appendChild(md);
    
    const actions = makeElement('div', 'message-actions');
    const buttons = role === 'assistant' ? [['pin', 'Pin'], ['copy', 'Copy'], ['regenerate', 'Regenerate'], ['delete', 'Delete']] : [['pin', 'Pin'], ['copy', 'Copy'], ['edit', 'Edit'], ['delete', 'Delete']];
    buttons.forEach(([act, lab]) => {
      const btn = makeElement('button', '', lab);
      btn.dataset.action = act;
      actions.appendChild(btn);
    });
    
    body.append(bubble, actions);
    if (role === 'assistant') {
      const feedback = makeElement('div', 'message-feedback');
      feedback.setAttribute('aria-label', 'Rate this response');
      [['helpful', 'Helpful'], ['not_helpful', 'Not helpful'], ['something_wrong', 'Something went wrong']].forEach(([rating, label]) => {
        const button = makeElement('button', '', label);
        button.type = 'button'; button.dataset.feedbackRating = rating; feedback.appendChild(button);
      });
      feedback.addEventListener('click', event => {
        const button = event.target.closest('[data-feedback-rating]');
        if (button) void submitPilotFeedback(wrap, button.dataset.feedbackRating);
      });
      body.appendChild(feedback);
    }
    if (role === 'assistant') wrap.appendChild(avatarDiv);
    wrap.appendChild(body);
    
    actions.addEventListener('click', async event => {
      const button = event.target.closest('button'); if (!button) return; const action = button.dataset.action;
      if (action === 'pin') togglePinnedMessage(wrap.dataset.pinKey, { role, text });
      if (action === 'copy') await navigator.clipboard?.writeText(wrap.querySelector('.bubble').innerText);
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
    const img = document.createElement('img'); img.src = '/assets/brand/logo-icon.svg'; img.alt = 'K'; img.width = 20;
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
    [['copy', 'Copy'], ['regenerate', 'Regenerate'], ['delete', 'Delete']].forEach(([act, lab]) => {
      const btn = makeElement('button', '', lab); btn.dataset.action = act; actions.appendChild(btn);
    });
    
    body.append(bubble, actions);
    wrap.append(avatar, body);
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
        status.textContent = 'Request deferred — Kurukoo will retain it for a supported next step. Any notification depends on a configured channel.';
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
      ? 'Checking request context for a supported nearby path…'
      : 'Assessing the request for a supported match. If no path is currently available, the request can be deferred.';
  }

  function collectStorefrontFields(holder) {
    const fields = {};
    holder.querySelectorAll('[data-storefront-field]').forEach(el => {
      const key = el.getAttribute('data-storefront-field');
      if (key) fields[key] = el.value.trim();
    });
    return fields;
  }

  async function advanceStorefront(requestId, action, fields, messageEl) {
    if (!requestId || state.busy) return;
    state.busy = true;
    if (send) send.disabled = true;
    try {
      const res = await fetch(`/api/chat/economic-requests/storefront/${encodeURIComponent(requestId)}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action, requirements: fields || {} })
      });
      if (res.status === 401) { await ensureIdentity(); throw new Error('Session expired'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not update request');
      const card = data.card;
      setDeferredStatus(card);
      if (card?.requestId) state.activeStorefrontId = card.requestId;
      const wrap = appendStreamBubble();
      const output = wrap.querySelector('.markdown-body');
      setMarkdown(output, card.message || 'Updated.');
      renderCard(card, wrap);
      state.messages.push({ role: 'assistant', text: card.message || '', id: null });
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
        const amount = Number.isInteger(price) ? `${price} ${String(offer.currency || 'NGN')}` : 'Price pending confirmation';
        details.append(
          makeElement('strong', '', offer.description || 'Seller offer'),
          makeElement('span', '', `${String(offer.sellerName || 'Seller')} · ${amount}`)
        );
        if (offer.availabilityNote) details.appendChild(makeElement('small', '', String(offer.availabilityNote)));
        const button = makeElement('button', 'sf-btn sf-primary', 'Choose offer');
        button.type = 'button';
        button.addEventListener('click', () => { void startKnownOffer(String(offer.id || '')); });
        item.append(details, button);
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
          makeElement('span', '', `Profile details · listed rate ${String(provider.hourly_rate || 0)} NGN`)
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
          makeElement('span', '', `Profile details · listed rate ${String(provider.hourly_rate || 0)} NGN`)
        );
        providers.appendChild(item);
      });
      holder.appendChild(providers);
    }

    if (Array.isArray(card.providerResponses) && card.providerResponses.length) {
      const responses = makeElement('section', 'storefront-known-offers');
      responses.appendChild(makeElement('strong', '', 'Provider responses'));
      const list = makeElement('ul', 'storefront-offers-list');
      card.providerResponses.forEach(response => {
        const item = makeElement('li');
        const details = makeElement('div');
        const amount = Number.isInteger(Number(response.quoteMinor)) ? `${String(response.quoteMinor)} ${String(response.currency || 'NGN')}` : 'Quote pending';
        details.append(makeElement('strong', '', String(response.providerName || 'Verified provider')), makeElement('span', '', `${String(response.status || 'invited').replace(/_/g, ' ')} · ${amount}`));
        if (response.note) details.appendChild(makeElement('small', '', String(response.note)));
        item.appendChild(details); list.appendChild(item);
      });
      responses.appendChild(list); holder.appendChild(responses);
    }

    if (card.quote) {
      const quote = makeElement('div', 'storefront-quote', 'Quote: ');
      quote.appendChild(makeElement('strong', '', `${String(card.quote.amount_minor)} ${String(card.quote.currency || 'NGN')}`));
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

    if (card.escrowProtected !== false) {
      const escrowBadge = makeElement('span', 'escrow-badge');
      escrowBadge.append(makeIcon('safety'), document.createTextNode('Escrow state requires confirmation'));
      holder.appendChild(escrowBadge);
    }

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
        btn.appendChild(makeElement('span', '', String(ad.disclosure || (ad.placementSource === 'kurukoo_sponsored' ? 'Kurukoo-sponsored' : 'External advertisement'))));
        btn.appendChild(makeElement('strong', '', ad.title));
        btn.title = 'Promotion is not provider verification, a quote, availability, payment, dispatch, or fulfilment evidence.';
        btn.addEventListener('click', () => sendMessage(ad.keyword || ad.title));
        holder.appendChild(btn);
      });
    }

    messageEl.appendChild(holder);
  }

  function renderCard(card, messageEl) {
    if (!card || !messageEl) return;
    if (card.type === 'agentic_storefront') {
      renderAgenticStorefront(card, messageEl);
      return renderSuggestions(card.suggestions, messageEl, card.sponsored);
    }
    if (card.type === 'suggestions') return renderSuggestions(card.options, messageEl, card.sponsored);
    if (card.type === 'intent_suggestions') return renderSuggestions(card.suggestions, messageEl, card.sponsored);
    if (card.type === 'ai_metadata') return updateModelStatus(card);

    if (card.type === 'auth_otp_input') {
      const holder = makeElement('section', 'auth-otp-card');
      holder.setAttribute('aria-label', 'Phone verification');
      holder.appendChild(makeElement('strong', '', 'Enter your verification code'));
      holder.appendChild(makeElement('p', 'auth-otp-copy', 'Enter the six-digit code sent to your phone.'));
      const cells = makeElement('div', 'auth-otp-cells');
      const inputs = Array.from({ length: 6 }, (_, index) => {
        const field = document.createElement('input');
        field.type = 'text'; field.inputMode = 'numeric'; field.pattern = '[0-9]*'; field.maxLength = 1;
        field.autocomplete = index === 0 ? 'one-time-code' : 'off';
        field.setAttribute('aria-label', `Verification digit ${index + 1} of 6`);
        field.addEventListener('input', () => { field.value = field.value.replace(/\D/g, '').slice(0, 1); if (field.value && inputs[index + 1]) inputs[index + 1].focus(); });
        field.addEventListener('keydown', event => { if (event.key === 'Backspace' && !field.value && inputs[index - 1]) inputs[index - 1].focus(); if (event.key === 'Enter') verify.click(); });
        field.addEventListener('paste', event => { const code = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || ''; if (!code) return; event.preventDefault(); code.split('').forEach((digit, digitIndex) => { if (inputs[digitIndex]) inputs[digitIndex].value = digit; }); inputs[Math.min(code.length, 6) - 1]?.focus(); });
        cells.appendChild(field); return field;
      });
      const verify = makeElement('button', 'primary-btn', 'Verify');
      verify.type = 'button';
      verify.addEventListener('click', () => { const code = inputs.map(field => field.value).join(''); if (code.length !== 6) { inputs.find(field => !field.value)?.focus(); return; } void sendMessage(code); });
      const actions = makeElement('div', 'auth-otp-actions');
      const resend = makeElement('button', 'text-btn', 'Resend code'); resend.type = 'button'; resend.addEventListener('click', () => void sendMessage('resend code'));
      const change = makeElement('button', 'text-btn', 'Change number'); change.type = 'button'; change.addEventListener('click', () => void sendMessage('change number'));
      actions.append(resend, change);
      holder.append(cells, verify, actions);
      messageEl.querySelector('.bubble').appendChild(holder);
      inputs[0]?.focus();
      return;
    }

    if (card.type === 'safety_contact_capture') {
      const holder = makeElement('div', 'safety-capture-card');
      const inner = makeElement('div', 'safety-capture-inner');
      const icon = makeElement('div', 'safety-capture-icon');
      icon.appendChild(makeIcon('safety'));
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
      const gate = document.createElement('div');
      gate.className = 'auth-gate-card';
      const signedIn = state.isGuest === false;
      const guestId = document.cookie.split('; ').find(row => row.startsWith('kurukoo_guest_id='))?.split('=')[1];
      const returnUrl = card.returnUrl || window.location.pathname + window.location.search;

      if (signedIn) {
        gate.classList.add('auth-gate-card--resolved');
        const continuationCard = card.continuationCard;
        const header = makeElement('div', 'auth-gate-header'); header.appendChild(makeElement('h4', '', "You're signed in"));
        const body = makeElement('div', 'auth-gate-body');
        const p = document.createElement('p'); p.textContent = continuationCard ? 'Your request is ready to continue.' : 'Your request is preserved. Share the remaining details above so Kurukoo can continue matching it.';
        body.appendChild(p);
        if (!continuationCard) {
          const btn = makeElement('button', 'primary-btn', 'Continue this request');
          btn.type = 'button';
          body.appendChild(btn);
        }
        gate.append(header, body);
        gate.querySelector('button')?.addEventListener('click', () => input?.focus());
        messageEl.querySelector('.bubble').appendChild(gate);
        if (continuationCard) renderCard(continuationCard, messageEl);
        return;
      } else {
        const header = makeElement('div', 'auth-gate-header'); header.appendChild(makeElement('h4', '', card.title || 'Sign in to Continue'));
        const body = makeElement('div', 'auth-gate-body');
        const p = document.createElement('p'); p.textContent = card.message || 'Please sign in to proceed with your request.';
        body.appendChild(p);
        const btn = makeElement('button', 'primary-btn', 'Tell Kurukoo your name');
        btn.type = 'button';
        btn.dataset.action = 'focus-input';
        body.appendChild(btn);
        gate.append(header, body);
        gate.querySelector('[data-action="focus-input"]')?.addEventListener('click', () => input?.focus());
      }
      messageEl.querySelector('.bubble').appendChild(gate);
      return;
    }

    const holder = document.createElement('div');
    holder.className = 'provider-card';
    if (card.type === 'ride_picker') {
      holder.appendChild(makeElement('strong', '', 'Describe a ride request'));
      const qa = makeElement('div', 'quick-actions');
      ['Okada', 'Keke', 'Taxi'].forEach(label => {
        const button = makeElement('button');
        button.type = 'button';
        button.append(makeIcon('ride'), document.createTextNode(label));
        qa.appendChild(button);
      });
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

  async function sendMessage(raw) {
    const text = String(raw || input.value || '').trim(); if (!text || state.busy || !(await ensureIdentity())) return;
    state.busy = true; send.disabled = true; setConnection(true); input.value = '';
    let attachment = state.attached;
    try {
      if (attachment instanceof File) { input.placeholder = 'Uploading attachment…'; attachment = await uploadAttachment(attachment); }
      state.attached = null; $('attachment-preview').hidden = true; $('attachment-preview').textContent = '';
      const finalText = attachment ? `${text}\n\n[Attachment: ${attachment.name} — ${attachment.type} — ${attachment.url}]` : text;
      const user = addUserMessage(finalText); const assistant = appendStreamBubble(); const output = assistant.querySelector('.markdown-body'); const thinking = assistant.querySelector('.thinking'); let full = '';
      const response = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ message: finalText, channel: 'web', conversationId: state.conversationId || undefined, attachment: attachment || undefined }) });
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
            state.isGuest = false; 
            setConnection(true); 
            $('logout-sidebar-btn').hidden = false;
            if (data.phone) localStorage.setItem('kurukoo_user_phone', data.phone);
          }
          if (data.type === 'metadata') updateModelStatus(data);
          if (data.type === 'status') setTypingStatus(data.status, data.label);
          if (data.type === 'agent_goal') renderAgentGoal(data.goal, []);
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
            if (data.cardData) renderCard(data.cardData, assistant);
            if (data.cardData?.type === 'agentic_storefront' && data.cardData.requestId) state.activeStorefrontId = data.cardData.requestId;
          }
          if (data.type === 'error') throw new Error(data.error || 'Stream error');
        }
      }
      state.messages.push({ role: 'user', text: finalText, id: Number(user.dataset.messageId) || null }); state.messages.push({ role: 'assistant', text: full, id: Number(assistant.dataset.messageId) || null });
      if (!full) output.textContent = 'I could not complete that request. Please try again.';
      await refreshHistory();
    } catch (error) { 
      setConnection(false, 'Connection issue'); setTypingStatus('error'); assistant.hidden = false; assistant.classList.remove('message-streaming'); assistant.classList.add('message-arrived');
      const bubble = chatContent.querySelector('.message.assistant:last-child .markdown-body'); 
      if (bubble) setMarkdown(bubble, `I’m having trouble completing that right now. **Please try again.**\n\n_${escapeAttr(error.message)}_`); 
    } finally { setTypingStatus('complete'); state.busy = false; send.disabled = false; input.placeholder = 'Tell Kurukoo what you need…'; input.focus(); loadPoints(); loadPresence(); loadReminders(); loadNotificationDeliveries(); loadSafety(); loadAgentGoal(); loadRequestContext(); }
  }

  function updateModelStatus(data) { const label = $('model-badge'); if (label && data.model) label.textContent = data.model; }
  async function loadPoints() { try { const res = await fetch('/api/points/balance', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const points = Number(data.points || 0); const balance = $('points-balance')?.querySelector('span'); if (balance) balance.textContent = points; const ip = $('inspector-points'); if (ip) ip.textContent = points; } catch {} }

  async function loadPresence() {
    const label = $('presence-label');
    const detail = $('presence-detail');
    if (!label || !detail) return;
    try {
      const response = await fetch('/api/presence/me', { credentials: 'same-origin' });
      if (response.status === 401) {
        label.textContent = 'Sign in to review Go Live status';
        detail.textContent = 'Go Live is available only to eligible providers who share a valid current location.';
        return;
      }
      if (!response.ok) throw new Error('Presence unavailable');
      const payload = await response.json();
      const presence = payload?.presence || {};
      if (!presence.active) {
        label.textContent = 'Not currently Go Live';
        detail.textContent = 'You are not currently shown on Nearby Radar. Go Live remains a time-bounded provider status, not a dispatch or broadcast.';
        return;
      }
      const expiry = presence.expiresAt ? new Date(presence.expiresAt) : null;
      const expiryCopy = expiry && !Number.isNaN(expiry.getTime()) ? ` until ${expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
      label.textContent = `Go Live · ${String(presence.source || 'provider')}`;
      detail.textContent = `${String(presence.skill || 'Eligible skill').replace(/_/g, ' ')} is shown as approximate presence${expiryCopy}. Exact coordinates are not displayed.`;
    } catch {
      label.textContent = 'Go Live status unavailable';
      detail.textContent = 'Kurukoo could not load your current presence state. No status change is implied.';
    }
  }

  const requestStageCopy = {
    requested: ['Request received', 'Kurukoo is collecting the details needed for a supported next step.'],
    awaiting_match: ['Finding options', 'Kurukoo is checking for an eligible option. You can keep the request active, broaden the search, or choose an alternative when offered.'],
    partially_matched: ['Options found', 'Some request details or confirmations are still needed before an option can progress.'],
    matched: ['Option matched', 'An eligible option is being checked against the request details.'],
    quoting: ['Quote requested', 'A provider quote is being prepared. A listed rate is not a confirmed quote.'],
    quoted: ['Quote ready', 'Review the confirmed quote before you decide whether to continue.'],
    awaiting_confirmation: ['Waiting for confirmation', 'Your request is not paid, booked, dispatched, or fulfilled at this stage.'],
    reserved: ['Reservation recorded', 'The next action is shown in the request flow.'],
    payment_pending: ['Payment pending', 'Payment is not complete until a configured payment boundary verifies it.'],
    paid: ['Payment verified', 'A verified payment state does not by itself confirm fulfilment.'],
    in_fulfillment: ['Fulfilment in progress', 'Follow the evidence-backed request updates here and in the conversation.'],
    fulfilled: ['Fulfilment recorded', 'Confirm completion only when the documented request evidence supports it.'],
    completed: ['Completed', 'This request remains connected to its conversation and any available follow-up.'],
    disputed: ['Under review', 'The request is paused while the dispute process is reviewed.'],
    cancelled: ['Cancelled', 'This request will not progress unless you start a new supported request.']
  };

  function requestDetail(request) {
    const source = request?.requirements || request?.requirements_json || {};
    let requirements = source;
    if (typeof source === 'string') { try { requirements = JSON.parse(source); } catch { requirements = {}; } }
    const details = [requirements?.items, requirements?.service, requirements?.location, requirements?.origin, requirements?.destination].filter(Boolean).map(String);
    return details.length ? details.slice(0, 2).join(' · ') : 'Details remain in the linked conversation.';
  }

  function renderRequestContext(request) {
    const card = $('request-context-card'); const title = $('request-context-title'); const detail = $('request-context-detail'); const timeline = $('request-context-timeline'); const inspectorTitle = $('inspector-title');
    if (!card || !title || !detail || !timeline) return;
    timeline.replaceChildren();
    if (!request) {
      if (inspectorTitle) inspectorTitle.textContent = 'About this conversation';
      title.textContent = 'No active request';
      detail.textContent = 'Relevant request details, next actions and state appear here as Kurukoo works with you.';
      return;
    }
    const status = String(request.status || 'requested');
    const [heading, copy] = requestStageCopy[status] || ['Request update', 'The linked conversation contains the current request details.'];
    if (inspectorTitle) inspectorTitle.textContent = heading;
    title.textContent = `${String(request.skill || request.category || 'Request').replace(/_/g, ' ')} · ${heading}`;
    detail.textContent = `${copy} ${requestDetail(request)}`;
    const stages = ['requested', 'awaiting_match', 'quoted', 'awaiting_confirmation', 'payment_pending', 'in_fulfillment', 'completed'];
    const currentIndex = Math.max(0, stages.indexOf(status));
    stages.forEach((stage, index) => {
      const item = makeElement('span', `request-context-step${index <= currentIndex ? ' is-reached' : ''}${stage === status ? ' is-current' : ''}`, requestStageCopy[stage]?.[0] || stage.replace(/_/g, ' '));
      timeline.appendChild(item);
    });
  }

  async function loadRequestContext() {
    try {
      const response = await fetch('/api/chat/economic-requests', { credentials: 'same-origin' });
      if (!response.ok) { renderRequestContext(null); return; }
      const data = await response.json(); const requests = Array.isArray(data.requests) ? data.requests : [];
      const active = requests.find(item => String(item.id || '') === String(state.activeStorefrontId || '')) || requests.find(item => !['completed', 'cancelled', 'abandoned'].includes(String(item.status || '')));
      renderRequestContext(active || requests[0] || null);
    } catch { renderRequestContext(null); }
  }

  async function loadMemory() { try { const res = await fetch('/api/profile', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const profile = data.profile || {}; const text = `Kurukoo remembers ${profile.location || 'your area'}${profile.primary_lga ? `, ${profile.primary_lga}` : ''}. Your Memory Profile remains attached to your account.`; const mc = $('memory-context'); if (mc) mc.textContent = text; const im = $('inspector-memory'); if (im) im.textContent = text; } catch {} }

  function notificationDeliveryCopy(value) {
    const state = String(value || 'queued').toLowerCase();
    const copy = {
      queued: 'Stored in Kurukoo’s internal queue. No external delivery is claimed.',
      accepted: 'A configured provider accepted the message. This is not a delivery receipt.',
      submitted: 'Submitted to a configured provider. Delivery has not been confirmed.',
      sent: 'The provider reports sending it. Delivery has not been confirmed.',
      delivered: 'A provider delivery receipt was recorded.',
      read: 'Read in Kurukoo or confirmed as read where a provider receipt supports it.',
      failed: 'The recorded delivery attempt failed. No delivery is claimed.',
      undeliverable: 'The recorded destination was undeliverable. No delivery is claimed.',
      not_configured: 'External transport is not configured. The notice remains internal only.',
      suppressed: 'Delivery was deliberately suppressed by policy or consent. No delivery is claimed.',
    };
    return copy[state] || 'Delivery state is unavailable. No external delivery is claimed.';
  }

  async function loadNotificationDeliveries() {
    const card = $('notification-deliveries-card');
    const list = $('notification-deliveries-list');
    if (!card || !list) return;
    try {
      const response = await fetch('/api/notifications?limit=8', { credentials: 'same-origin' });
      if (response.status === 401) { card.hidden = true; return; }
      if (!response.ok) throw new Error('Notification delivery status unavailable');
      const data = await response.json();
      const notifications = Array.isArray(data.notifications) ? data.notifications : [];
      card.hidden = false;
      list.replaceChildren();
      if (!notifications.length) {
        list.appendChild(makeElement('div', 'empty-state', 'No internal notification delivery records are available.'));
        return;
      }
      notifications.forEach(notification => {
        const row = makeElement('div', 'reminder-list-item notification-delivery-item');
        const title = makeElement('strong', '', String(notification.title || 'Notification'));
        const detail = makeElement('span', '', notificationDeliveryCopy(notification.delivery_state));
        const state = makeElement('span', 'status-pill', String(notification.delivery_state || 'queued').replace(/_/g, ' '));
        row.append(title, detail, state);
        list.appendChild(row);
      });
    } catch {
      card.hidden = false;
      list.replaceChildren(makeElement('div', 'empty-state', 'Notification delivery status is unavailable. No status change is implied.'));
    }
  }

  function renderAgentGoal(goal, events = []) {
    const card = $('agent-goal-card'); const status = $('agent-goal-status'); const summary = $('agent-goal-summary'); const list = $('agent-goal-events'); const cancel = $('agent-goal-cancel');
    if (!card || !status || !summary || !list || !cancel) return;
    if (!goal) { card.hidden = true; return; }
    card.hidden = false; card.dataset.goalId = String(goal.id || '');
    status.textContent = String(goal.status || 'checking').replace(/_/g, ' ');
    summary.textContent = String(goal.summary || goal.objective || 'Kurukoo is checking the current objective.');
    list.replaceChildren();
    (Array.isArray(events) ? events.slice(-4) : []).forEach(event => {
      const row = makeElement('div', 'agent-goal-event');
      row.textContent = `${String(event.result || 'update').replace(/_/g, ' ')} · ${String(event.detail || event.action || '').slice(0, 180)}`;
      list.appendChild(row);
    });
    if (!list.childElementCount) list.appendChild(makeElement('div', 'empty-state', 'Kurukoo will show confirmed activity here.'));
    const stoppable = ['active', 'waiting', 'needs_user', 'blocked'].includes(String(goal.status || ''));
    cancel.hidden = !stoppable;
    cancel.onclick = async () => {
      if (!goal.id) return; cancel.disabled = true;
      try { const response = await fetch(`/api/agent/goals/${encodeURIComponent(goal.id)}/cancel`, { method: 'POST', credentials: 'same-origin' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Could not stop follow-up.'); renderAgentGoal(data.goal, events); }
      catch (error) { setInspectorFeedback(error.message || 'Could not stop follow-up.', 'error'); }
      finally { cancel.disabled = false; }
    };
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
        cancel.addEventListener('click', async () => { cancel.disabled = true; await fetch(`/api/reminders/${encodeURIComponent(reminder.id)}/cancel`, { method: 'POST', credentials: 'same-origin' }); loadReminders(); });
        row.append(title, due, cancel); list.appendChild(row);
      });
    } catch {}
  }

  function setInspectorFeedback(message, kind = 'info') { const feedback = $('inspector-feedback'); if (!feedback) return; feedback.hidden = !message; feedback.textContent = message || ''; feedback.dataset.kind = kind; }
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
      const res = await fetch(url, { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const list = $('history-list'); if (!list) return; list.replaceChildren();
      data.conversations.forEach(c => addHistoryItem(c, c.id === state.conversationId));
      if (data.messages?.length && chatContent.querySelectorAll('.message').length === 0) renderMessages(data.messages);
    } catch { setConnection(false, 'Offline'); }
    loadAgentGoal();
    loadRequestContext();
    loadPresence();
  }

  function renderMessages(messages) {
    chatContent.replaceChildren();
    messages.forEach(m => {
      let cardData = null;
      if (m.card_data) try { cardData = JSON.parse(m.card_data); } catch {}
      createMessage(m.sender === 'user' ? 'user' : 'assistant', m.content, m.id, cardData, false);
    });
  }

  function setInspectorOpen(open, target = null) {
    const inspector = $('chat-inspector'); if (!inspector) return;
    inspector.classList.toggle('open', open);
    if (target) {
      inspector.querySelectorAll('.inspector-card').forEach(card => card.hidden = true);
      const targetCard = $(target); if (targetCard) targetCard.hidden = false;
    }
  }

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

  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  send?.addEventListener('click', () => sendMessage());
  $('new-chat')?.addEventListener('click', async () => { 
    if (!await ensureIdentity()) return; 
    try { 
      const res = await fetch('/api/chat/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ channel: 'web', title: 'New conversation' }) }); 
      const data = await res.json(); 
      if (data.conversationId) { state.conversationId = data.conversationId; localStorage.setItem('kurukoo_conversation_id', data.conversationId); } 
    } catch {} 
    state.messages = []; state.activeStorefrontId = null; chatContent.replaceChildren(); 
    const ds = $('deferred-status'); if (ds) ds.hidden = true; 
    renderWelcome(); refreshHistory(); 
  });
  
  $('logout-button')?.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    localStorage.removeItem('kurukoo_user_phone');
    localStorage.removeItem('kurukoo_user_name');
    window.location.assign('/');
  });

  function renderWelcome() {
    const welcome = makeElement('div', 'welcome'); welcome.id = 'welcome';
    const mark = makeElement('div', 'welcome-mark');
    const img = document.createElement('img'); img.src = '/assets/brand/logo-icon.svg'; img.alt = 'Kurukoo'; img.width = 32;
    mark.appendChild(img);
    welcome.appendChild(mark);
    welcome.appendChild(makeElement('h1', '', 'Hi, I’m Kurukoo. What do you need help with?'));
    welcome.appendChild(makeElement('p', '', 'Start with a conversation. Kurukoo combines personal assistance, a provider and inventory network, and bounded goal follow-up to organise supported next steps. External execution happens only when the required authority, integration and evidence are available.'));
    const qa = makeElement('div', 'quick-actions'); qa.id = 'quick-actions';
    [
      ['I need a ride request', 'Ride', 'ride'],
      ['I have a food request', 'Food', 'food'],
      ['I need repair help', 'Repair', 'request'],
      ['I have an urgent non-emergency service request', 'Urgent request', 'alert'],
      ['I want to discuss a work request', 'Work', 'work']
    ].forEach(([prompt, label, icon]) => {
      const button = makeElement('button');
      button.dataset.prompt = prompt;
      button.append(makeIcon(icon), document.createTextNode(label));
      qa.appendChild(button);
    });
    welcome.appendChild(qa);
    chatContent.replaceChildren(welcome);
    wireQuickActions($('quick-actions'));
  }

  applyTheme();
  ensureIdentity().then(ok => { 
    if (ok) {
      Promise.all([loadPoints(), loadPresence(), loadMemory(), loadReminders(), loadNotificationDeliveries(), loadSafety(), loadAgentGoal(), loadRequestContext(), refreshHistory()]);
      if (!state.conversationId) renderWelcome();
    }
  });

})();
