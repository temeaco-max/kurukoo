(() => {
  const state = {
    conversationId: localStorage.getItem('kurukoo_conversation_id') || '',
    messages: [], busy: false, attached: null,
    theme: localStorage.getItem('kurukoo_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    activeStorefrontId: null,
    nativeAssistance: { reminders: [], checkIns: [] }
  };
  const $ = id => document.getElementById(id);
  const chatContent = $('chat-content'), scroll = $('chat-scroll'), input = $('message-input'), send = $('send-message');
  const isEmbed = (() => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('embed') === '1' || params.get('embed') === 'true') return true;
      if (window.self !== window.top) return true;
    } catch (_) { return true; }
    return false;
  })();
  const setConnection = (ok, text = ok ? 'Connected' : 'Offline') => { const el = $('connection-status'); if (el) { el.innerHTML = `<span class="status-dot"></span> ${text}`; el.classList.toggle('offline', !ok); } };
  const applyTheme = () => { document.body.classList.toggle('dark', state.theme === 'dark'); localStorage.setItem('kurukoo_theme', state.theme); };
  function sanitizeHtml(html) { const doc = new DOMParser().parseFromString(html, 'text/html'); doc.querySelectorAll('script,iframe,object,embed,style,link,form').forEach(n => n.remove()); doc.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || /^(javascript|data):/i.test(a.value)) n.removeAttribute(a.name); })); return doc.body.innerHTML; }
  function renderMarkdown(text) { if (!window.marked) return String(text || '').replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c])).replace(/\n/g, '<br>'); marked.setOptions({ breaks: true, gfm: true }); return sanitizeHtml(marked.parse(text || '')); }
  function enhanceCode(root) { root.querySelectorAll('pre code').forEach(block => { if (window.hljs && !block.dataset.highlighted) hljs.highlightElement(block); }); }
  function escapeAttr(value) { return String(value || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeText(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function updateNativeAssistanceStatus() {
    const banner = $('native-assistance-status'); if (!banner) return;
    const now = Date.now(); const reminders = Array.isArray(state.nativeAssistance?.reminders) ? state.nativeAssistance.reminders : []; const checkIns = Array.isArray(state.nativeAssistance?.checkIns) ? state.nativeAssistance.checkIns : [];
    const activeCheckIns = checkIns.filter(item => item?.status === 'active' && item?.expires_at).map(item => ({ ...item, expiresAt: new Date(item.expires_at).getTime() })).filter(item => Number.isFinite(item.expiresAt)).sort((a, b) => a.expiresAt - b.expiresAt);
    const expiringCheckIn = activeCheckIns.find(item => item.expiresAt <= now + (2 * 60 * 60 * 1000));
    if (expiringCheckIn) {
      const when = expiringCheckIn.expiresAt <= now ? 'has reached its scheduled end' : `ends at ${new Date(expiringCheckIn.expiresAt).toLocaleString()}`;
      banner.textContent = `Personal safety check-in ${when}. Review it in the context inspector; no contact is notified automatically.`; banner.dataset.kind = 'safety'; banner.hidden = false; return;
    }
    const upcomingReminder = reminders.filter(item => item?.status === 'active' && item?.due_at).map(item => ({ ...item, dueAt: new Date(item.due_at).getTime() })).filter(item => Number.isFinite(item.dueAt) && item.dueAt <= now + (24 * 60 * 60 * 1000)).sort((a, b) => a.dueAt - b.dueAt)[0];
    if (upcomingReminder) { const title = String(upcomingReminder.title || 'Reminder'); const due = upcomingReminder.dueAt <= now ? 'needs your attention now' : `is scheduled for ${new Date(upcomingReminder.dueAt).toLocaleString()}`; banner.textContent = `Reminder: ${title} ${due}. Review it in the context inspector.`; banner.dataset.kind = 'reminder'; banner.hidden = false; return; }
    banner.hidden = true; banner.textContent = '';
  }

  function showEmbedSignInGate() {
    if (!chatContent || chatContent.querySelector('[data-embed-signin-gate]')) return;
    const gate = document.createElement('div');
    gate.dataset.embedSigninGate = '1';
    gate.className = 'message assistant';
    gate.innerHTML = `
      <div class="avatar" aria-hidden="true">K</div>
      <div class="message-body">
        <div class="bubble">
          <div class="markdown-body">
            <p><strong>Sign in to chat with Kurukoo</strong></p>
            <p>Your Memory Profile and conversation history stay private until you sign in. Open the full chat to continue.</p>
            <p><a class="primary-btn" href="/login?return=${encodeURIComponent('/chat')}" target="_top" rel="noopener">Sign in</a>
            <a class="secondary-btn" href="/chat" target="_top" rel="noopener" class="embed-open-chat">Open full chat</a></p>
          </div>
        </div>
      </div>`;
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
      // Allow Conversation First for visitors without an authenticated session.
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
    if (!item) { item = document.createElement('button'); item.type = 'button'; item.className = 'history-item'; item.dataset.conversationId = conversation.id; item.textContent = conversation.title || 'New conversation'; item.addEventListener('click', () => loadConversation(conversation.id)); list.appendChild(item); }
    item.classList.toggle('active', active);
  }

  function createMessage(role, text = '', id = null, cardData = null) {
    const wrap = document.createElement('article'); wrap.className = `message ${role}`; if (id) wrap.dataset.messageId = id;
    const avatar = role === 'assistant' ? '<div class="avatar" aria-hidden="true"><img src="/assets/brand/logo-icon.svg" alt="K" width="20"></div>' : '';
    wrap.innerHTML = `${avatar}<div class="message-body"><div class="bubble"><div class="markdown-body"></div></div><div class="message-actions"></div></div>`;
    const bubble = wrap.querySelector('.markdown-body'); bubble.innerHTML = renderMarkdown(text); enhanceCode(wrap);
    const actions = wrap.querySelector('.message-actions');
    actions.innerHTML = role === 'assistant' ? '<button data-action="copy">Copy</button><button data-action="regenerate">Regenerate</button><button data-action="delete">Delete</button>' : '<button data-action="copy">Copy</button><button data-action="edit">Edit</button><button data-action="delete">Delete</button>';
    actions.addEventListener('click', async event => {
      const button = event.target.closest('button'); if (!button) return; const action = button.dataset.action;
      if (action === 'copy') await navigator.clipboard?.writeText(wrap.querySelector('.bubble').innerText);
      if (action === 'edit') { input.value = text; input.focus(); input.dispatchEvent(new Event('input')); }
      if (action === 'delete') { 
        if (state.isGuest) {
          alert('Please sign in to delete messages.');
          return;
        }
        if (wrap.dataset.messageId) await deleteMessage(Number(wrap.dataset.messageId)); 
        wrap.remove(); 
      }
      if (action === 'regenerate') { 
        if (state.isGuest) {
          alert('Please sign in to regenerate messages.');
          return;
        }
        const lastUser = [...state.messages].reverse().find(m => m.role === 'user'); 
        if (lastUser) await sendMessage(lastUser.text); 
      }
    });
    chatContent.appendChild(wrap); if (cardData) renderCard(cardData, wrap); scroll.scrollTop = scroll.scrollHeight; return wrap;
  }

  function appendStreamBubble() {
    $('welcome')?.remove(); const wrap = document.createElement('article'); wrap.className = 'message assistant';
    wrap.innerHTML = '<div class="avatar" aria-hidden="true"><img src="/assets/brand/logo-icon.svg" alt="K" width="20"></div><div class="message-body"><div class="bubble"><div class="markdown-body"></div><div class="thinking" hidden><details><summary>Reasoning completed</summary><div>Kurukoo selected the appropriate response path. Private model reasoning is not exposed.</div></details></div></div><div class="message-actions"><button data-action="copy">Copy</button><button data-action="regenerate">Regenerate</button><button data-action="delete">Delete</button></div></div>';
    chatContent.appendChild(wrap); return wrap;
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
      output.innerHTML = renderMarkdown(card.message || 'Updated.');
      renderCard(card, wrap);
      state.messages.push({ role: 'assistant', text: card.message || '', id: null });
      scroll.scrollTop = scroll.scrollHeight;
      await loadPoints();
    } catch (error) {
      setConnection(false, 'Connection issue');
      const wrap = appendStreamBubble();
      wrap.querySelector('.markdown-body').innerHTML = renderMarkdown(`Could not continue that request. **${escapeText(error.message)}**`);
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
      wrap.querySelector('.markdown-body').innerHTML = renderMarkdown(card.message || 'Offer selected.');
      renderCard(card, wrap);
      state.messages.push({ role: 'assistant', text: card.message || '', id: null });
      scroll.scrollTop = scroll.scrollHeight;
      await loadPoints();
    } catch (error) {
      const wrap = appendStreamBubble();
      wrap.querySelector('.markdown-body').innerHTML = renderMarkdown(`Could not select that offer. **${escapeText(error.message)}**`);
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
      wrap.querySelector('.markdown-body').innerHTML = renderMarkdown(card.message || 'Delivery provider selected.');
      renderCard(card, wrap);
      state.messages.push({ role: 'assistant', text: card.message || '', id: null });
      scroll.scrollTop = scroll.scrollHeight;
    } catch (error) {
      const wrap = appendStreamBubble();
      wrap.querySelector('.markdown-body').innerHTML = renderMarkdown(`Could not select that delivery provider. **${escapeText(error.message)}**`);
    } finally { state.busy = false; if (send) send.disabled = false; }
  }

  function makeElement(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = String(text);
    return element;
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

  function renderSuggestions(options, messageEl, sponsored = []) {
    if ((!Array.isArray(options) || !options.length) && (!Array.isArray(sponsored) || !sponsored.length)) return;
    const holder = document.createElement('div');
    holder.className = 'suggestions-list';
    
    if (Array.isArray(options)) {
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggestion-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => sendMessage(opt));
        holder.appendChild(btn);
      });
    }

    if (Array.isArray(sponsored)) {
      sponsored.forEach(ad => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggestion-btn sponsored';
        btn.innerHTML = `<span>Sponsored</span><strong>${escapeText(ad.title)}</strong>`;
        btn.addEventListener('click', () => sendMessage(ad.keyword || ad.title));
        holder.appendChild(btn);
      });
    }
    
    messageEl.querySelector('.bubble').appendChild(holder);
  }

  function renderCard(card, messageEl) {
    if (!card || !messageEl) return;
    if (card.suggestions) renderSuggestions(card.suggestions, messageEl, card.sponsored);
    if (card.type === 'suggestions') { renderSuggestions(card.options, messageEl, card.sponsored); return; }
    if (card.type === 'agentic_storefront') { renderAgenticStorefront(card, messageEl); return; }
    
    if (card.type === 'safety_contact_added') {
      const holder = document.createElement('div');
      holder.className = 'provider-card';
      holder.innerHTML = `
        <div style="text-align:center; padding:10px;">
          <div style="font-size:2rem; margin-bottom:10px;">🛡️</div>
          <strong style="display:block; margin-bottom:5px;">Contact Saved</strong>
          <p style="font-size:0.9rem; color:var(--chat-muted); margin-bottom:15px;">${escapeText(card.name)} has been added to your safety contacts.</p>
          <button type="button" class="sf-btn sf-secondary" data-action="view-safety">View Contacts</button>
        </div>`;
      holder.querySelector('[data-action="view-safety"]')?.addEventListener('click', () => setInspectorOpen(true, 'safety-card'));
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
        gate.innerHTML = `
          <div class="auth-gate-header"><h4>You're signed in</h4></div>
          <div class="auth-gate-body">
            <p>${continuationCard ? 'Your request is ready to continue.' : 'Your request is preserved. Share the remaining details above so Kurukoo can continue matching it.'}</p>
            ${continuationCard ? '' : '<button type="button" class="primary-btn">Continue this request</button>'}
          </div>`;
        gate.querySelector('button')?.addEventListener('click', () => input?.focus());
        messageEl.querySelector('.bubble').appendChild(gate);
        if (continuationCard) renderCard(continuationCard, messageEl);
        return;
      } else {
        gate.innerHTML = `
          <div class="auth-gate-header">
            <h4>${escapeText(card.title || 'Sign in to Continue')}</h4>
          </div>
          <div class="auth-gate-body">
            <p>${escapeText(card.message || 'Please sign in to proceed with your request.')}</p>
            ${card.type === 'auth_in_chat_start' ? '<button type="button" class="primary-btn" data-action="focus-input">Tell Kurukoo your name</button>' : `<a href="/login?return=${encodeURIComponent(returnUrl)}${guestId ? `&guest_id=${guestId}` : ''}" class="primary-btn">Sign in to Kurukoo</a>`}
          </div>`;
        gate.querySelector('[data-action="focus-input"]')?.addEventListener('click', () => input?.focus());
      }
      messageEl.querySelector('.bubble').appendChild(gate);
      return;
    }

    const holder = document.createElement('div');
    holder.className = 'provider-card';
    if (card.type === 'ride_picker') {
      holder.innerHTML = '<strong>Describe a ride request</strong><div class="quick-actions"><button type="button">🚗 Okada</button><button type="button">🛺 Keke</button><button type="button">🚕 Taxi</button></div><span class="escrow-badge">Availability is confirmed in the request flow.</span>';
      holder.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => sendMessage(`${btn.textContent.trim()} ride`)));
    } else if (card.type === 'worker_match' || card.type === 'service_search') {
      holder.innerHTML = `<strong>${card.category === 'food' ? 'Food request' : 'Service request'}</strong><div class="deferred">Kurukoo is assessing the request context for a supported path.</div><span class="escrow-badge">Availability is confirmed before a next action is presented.</span>`;
    } else if (card.type === 'nearby_radar') {
      holder.innerHTML = '<strong>Nearby context</strong><div class="deferred">Location-based information is shown only when relevant data is available.</div>';
    } else if (card.type === 'sports_search') {
      holder.innerHTML = '<strong>Sports network</strong><div class="deferred">Searching leagues, teams, matches and nearby play.</div>';
    } else if (card.type === 'event_coverage') {
      holder.innerHTML = '<strong>Event coverage request</strong><div class="deferred">Contributor participation and any resulting payment step require separate confirmation.</div>';
    } else if (card.type === 'security_booking') {
      holder.innerHTML = '<strong>Security-related request</strong><span class="escrow-badge">Provider suitability and availability require confirmation.</span>';
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
      holder.innerHTML = '<strong>Creator request</strong><div class="deferred">Availability and representation details require confirmation before a request can proceed.</div><span class="escrow-badge">Payment availability is assessed separately.</span>';
    } else {
      holder.innerHTML = `<strong>${escapeAttr(card.category || card.type || 'Kurukoo action')}</strong>`;
    }
    messageEl.querySelector('.bubble').appendChild(holder);
  }

  async function uploadAttachment(file) {
    const allowed = /^(image\/(png|jpeg|webp|gif)|application\/pdf|video\/mp4|video\/webm)$/i.test(file.type || '');
    if (!allowed) throw new Error('Unsupported attachment type. Use an image, PDF or supported video.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Attachment is larger than the 25 MB chat limit.');
    const reader = new FileReader(); const data = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
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
            if (data.token) localStorage.setItem('kurukoo_auth_token', data.token);
            if (data.phone) localStorage.setItem('kurukoo_user_phone', data.phone);
          }
          if (data.type === 'metadata') updateModelStatus(data);
          if (data.type === 'thought' && thinking) thinking.hidden = false;
          if (data.type === 'text') { full += data.content || ''; output.innerHTML = renderMarkdown(full); enhanceCode(assistant); scroll.scrollTop = scroll.scrollHeight; }
          if (data.type === 'done') {
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
    } catch (error) { setConnection(false, 'Connection issue'); const bubble = chatContent.querySelector('.message.assistant:last-child .markdown-body'); if (bubble) bubble.innerHTML = renderMarkdown(`I’m having trouble completing that right now. **Please try again.**\n\n_${escapeAttr(error.message)}_`); }
    finally { state.busy = false; send.disabled = false; input.placeholder = 'Message Kurukoo'; input.focus(); loadPoints(); loadReminders(); loadSafety(); }
  }

  function updateModelStatus(data) { const label = $('model-badge'); if (label && data.model) label.textContent = data.model; }
  async function loadPoints() { try { const res = await fetch('/api/points/balance', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const points = Number(data.points || 0); const balance = $('points-balance')?.querySelector('span'); if (balance) balance.textContent = points; const ip = $('inspector-points'); if (ip) ip.textContent = points; } catch {} }
  async function loadMemory() { try { const res = await fetch('/api/profile', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const profile = data.profile || {}; const text = `Kurukoo remembers ${profile.location || 'your area'}${profile.primary_lga ? `, ${profile.primary_lga}` : ''}. Your Memory Profile remains attached to your account.`; const mc = $('memory-context'); if (mc) mc.textContent = text; const im = $('inspector-memory'); if (im) im.textContent = text; } catch {} }
  async function loadReminders() {
    try {
      const res = await fetch('/api/reminders', { credentials: 'same-origin' });
      const card = $('reminders-card'); const list = $('reminder-list');
      if (!res.ok || !card || !list) return;
      const data = await res.json(); const reminders = Array.isArray(data.reminders) ? data.reminders : []; state.nativeAssistance.reminders = reminders; updateNativeAssistanceStatus();
      card.hidden = false; list.innerHTML = '';
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
      const checkIns = Array.isArray(checkInsData.checkIns) ? checkInsData.checkIns : []; state.nativeAssistance.checkIns = checkIns; updateNativeAssistanceStatus();
      card.hidden = false; contactsList.innerHTML = ''; checkInsList.innerHTML = '';
      const contactHeading = document.createElement('strong'); contactHeading.textContent = contacts.length ? 'Contacts' : 'No safety contacts yet.'; contactsList.appendChild(contactHeading);
      contacts.forEach(contact => {
        const row = document.createElement('div'); row.className = 'safety-list-item';
        const label = document.createElement('span'); label.textContent = `${contact.name} · ${contact.status}`; row.appendChild(label);
        if (contact.status === 'pending') {
          const activate = document.createElement('button'); activate.className = 'text-btn'; activate.type = 'button'; activate.textContent = 'Confirm consent';
          activate.addEventListener('click', async () => { activate.disabled = true; try { await nativeAction(`/api/safety/contacts/${encodeURIComponent(contact.id)}/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consentConfirmed: true }) }); setInspectorFeedback('Contact activated by your explicit consent. No notification was sent.'); await loadSafety(); } catch (error) { setInspectorFeedback(error.message, 'error'); } finally { activate.disabled = false; } });
          row.appendChild(activate);
        } else if (contact.status === 'active') {
          const start = document.createElement('button'); start.className = 'text-btn'; start.type = 'button'; start.textContent = 'Start 60-minute check-in';
          start.addEventListener('click', async () => { start.disabled = true; try { await nativeAction('/api/safety/check-ins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: contact.id, durationMinutes: 60 }) }); setInspectorFeedback('60-minute check-in started. This remains a personal instruction and does not contact emergency services.'); await loadSafety(); } catch (error) { setInspectorFeedback(error.message, 'error'); } finally { start.disabled = false; } });
          row.appendChild(start);
        }
        const revoke = document.createElement('button'); revoke.className = 'text-btn text-btn-danger'; revoke.type = 'button'; revoke.textContent = 'Revoke'; revoke.addEventListener('click', async () => { revoke.disabled = true; try { await nativeAction(`/api/safety/contacts/${encodeURIComponent(contact.id)}/revoke`, { method: 'POST' }); setInspectorFeedback('Safety contact revoked.'); await loadSafety(); } catch (error) { setInspectorFeedback(error.message, 'error'); } finally { revoke.disabled = false; } }); row.appendChild(revoke);
        contactsList.appendChild(row);
      });
      const checkInHeading = document.createElement('strong'); checkInHeading.textContent = 'Check-ins'; checkInsList.appendChild(checkInHeading);
      if (!checkIns.length) { const empty = document.createElement('span'); empty.textContent = 'No check-ins yet.'; checkInsList.appendChild(empty); }
      checkIns.forEach(checkIn => {
        const row = document.createElement('div'); row.className = 'safety-list-item';
        const status = document.createElement('span'); const expires = checkIn.expires_at ? new Date(checkIn.expires_at) : null; const when = expires && !Number.isNaN(expires.getTime()) ? ` · ${expires.toLocaleString()}` : ''; status.textContent = `${checkIn.status}${when}`; row.appendChild(status);
        if (checkIn.status === 'active') { const complete = document.createElement('button'); complete.className = 'text-btn'; complete.type = 'button'; complete.textContent = 'Complete'; complete.addEventListener('click', async () => { complete.disabled = true; try { await nativeAction(`/api/safety/check-ins/${encodeURIComponent(checkIn.id)}/complete`, { method: 'POST' }); setInspectorFeedback('Check-in completed.'); await loadSafety(); } catch (error) { setInspectorFeedback(error.message, 'error'); } finally { complete.disabled = false; } }); row.appendChild(complete); }
        checkInsList.appendChild(row);
      });
    } catch {}
  }

  async function refreshHistory() {
    try {
      const url = new URL('/api/chat/history', location.origin); if (state.conversationId) url.searchParams.set('conversationId', state.conversationId); url.searchParams.set('limit', '60');
      const res = await fetch(url, { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const list = $('history-list'); if (!list) return; list.innerHTML = '';
      data.conversations.forEach(c => addHistoryItem(c, c.id === state.conversationId));
      if (data.messages?.length && chatContent.querySelectorAll('.message').length === 0) renderMessages(data.messages);
    } catch { setConnection(false, 'Offline'); }
  }
  function renderMessages(messages) { $('welcome')?.remove(); chatContent.querySelectorAll('.message').forEach(n => n.remove()); state.messages = []; messages.forEach(m => { state.messages.push({ role: m.sender, text: m.content, id: m.id }); createMessage(m.sender === 'user' ? 'user' : 'assistant', m.content || '', m.id, m.card_data ? safeJson(m.card_data) : null); }); scroll.scrollTop = scroll.scrollHeight; }
  function safeJson(value) { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } }
  async function loadConversation(id) { state.conversationId = id; localStorage.setItem('kurukoo_conversation_id', id); const url = new URL('/api/chat/history', location.origin); url.searchParams.set('conversationId', id); url.searchParams.set('limit', '100'); const res = await fetch(url, { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); renderMessages(data.messages || []); await refreshHistory(); $('chat-sidebar')?.classList.remove('open'); }
  async function deleteMessage(id) { if (!id) return; try { await fetch(`/api/chat/message/${id}`, { method: 'DELETE', credentials: 'same-origin' }); } catch {} }

  function wireQuickActions(root) { if (!root || root.dataset.wired) return; root.dataset.wired = 'true'; root.addEventListener('click', e => { const button = e.target.closest('button[data-prompt]'); if (button) sendMessage(button.dataset.prompt); }); }
  wireQuickActions($('quick-actions')); wireQuickActions($('composer-quick-actions'));
  send?.addEventListener('click', () => sendMessage());
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  $('attach-file')?.addEventListener('click', () => $('file-input')?.click());
  $('file-input')?.addEventListener('change', e => { const file = e.target.files?.[0] || null; state.attached = file; const preview = $('attachment-preview'); if (file && preview) { preview.hidden = false; preview.textContent = `📎 ${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`; } });
  $('theme-toggle')?.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); });
  function setSidebarOpen(open) { const sidebar = $('chat-sidebar'); const toggle = $('open-sidebar'); sidebar?.classList.toggle('open', open); toggle?.setAttribute('aria-expanded', String(open)); if (!open) toggle?.focus(); }
  function setInspectorOpen(open, sectionId = null) {
    const inspector = $('chat-inspector');
    const toggle = $('memory-toggle');
    const collapsible = window.matchMedia('(max-width: 1100px)').matches;
    if (collapsible) inspector?.classList.toggle('open', open);
    toggle?.setAttribute('aria-expanded', String(collapsible ? open : true));
    if (open && sectionId) {
      const section = $(sectionId);
      if (section) {
        section.hidden = false;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    if (open && collapsible) inspector?.querySelector('button, input, textarea')?.focus();
  }
  $('open-sidebar')?.addEventListener('click', () => setSidebarOpen(true));
  $('close-sidebar')?.addEventListener('click', () => setSidebarOpen(false));
  $('memory-toggle')?.addEventListener('click', () => setInspectorOpen(!$('chat-inspector')?.classList.contains('open')));
  $('close-inspector')?.addEventListener('click', () => setInspectorOpen(false));
  
  // Sidebar wiring
  $('sidebar-reminders')?.addEventListener('click', () => { setInspectorOpen(true, 'reminders-card'); setSidebarOpen(false); });
  $('sidebar-safety')?.addEventListener('click', () => { setInspectorOpen(true, 'safety-card'); setSidebarOpen(false); });
  $('sidebar-points')?.addEventListener('click', () => { setInspectorOpen(true, 'inspector-points'); setSidebarOpen(false); });
  $('logout-sidebar-btn')?.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    localStorage.removeItem('kurukoo_auth_token');
    localStorage.removeItem('kurukoo_user_phone');
    localStorage.removeItem('kurukoo_user_name');
    window.location.assign('/');
  });

  setInspectorOpen(false);
  $('new-chat')?.addEventListener('click', async () => { if (!await ensureIdentity()) return; try { const res = await fetch('/api/chat/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ channel: 'web', title: 'New conversation' }) }); const data = await res.json(); if (data.conversationId) { state.conversationId = data.conversationId; localStorage.setItem('kurukoo_conversation_id', data.conversationId); } } catch {} state.messages = []; state.activeStorefrontId = null; chatContent.innerHTML = ''; const ds = $('deferred-status'); if (ds) ds.hidden = true; renderWelcome(); refreshHistory(); });
  $('topup-points')?.addEventListener('click', () => sendMessage('I have a question about Points'));
  $('safety-contact-form')?.addEventListener('submit', async event => { event.preventDefault(); const name = $('safety-contact-name')?.value.trim(); const phone = $('safety-contact-phone')?.value.trim(); const relationship = $('safety-contact-relationship')?.value.trim(); if (!name || !phone) return; const submit = event.target.querySelector('button[type="submit"]'); if (submit) submit.disabled = true; try { await nativeAction('/api/safety/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, relationship }) }); event.target.reset(); setInspectorFeedback('Pending contact saved. Review the explicit consent action before activation.'); await loadSafety(); } catch (error) { setInspectorFeedback(error.message, 'error'); } finally { if (submit) submit.disabled = false; } });
  $('points-balance')?.addEventListener('click', () => sendMessage('Show my Points balance and the actions available to me'));
  $('voice-input')?.addEventListener('click', () => { const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Recognition) return input?.focus(); const recognition = new Recognition(); recognition.lang = 'en-NG'; recognition.onresult = e => { if (input) { input.value = e.results[0][0].transcript; input.dispatchEvent(new Event('input')); } }; recognition.start(); });
  function renderWelcome() { chatContent.innerHTML = '<div class="welcome" id="welcome"><div class="welcome-mark"><img src="/assets/brand/logo-icon.svg" alt="K" width="32"></div><h1>What can I help you get done?</h1><p>Describe a service, work, coordination, or everyday information need. Kurukoo will show the supported request path.</p><div class="quick-actions" id="quick-actions"><button data-prompt="I need a ride request">🚗 Ride</button><button data-prompt="I have a food request">🍔 Food</button><button data-prompt="I need repair help">🔧 Repair</button><button data-prompt="I have an urgent non-emergency service request">🏥 Urgent request</button><button data-prompt="I want to discuss a work request">⚡ Work</button></div></div>'; wireQuickActions($('quick-actions')); }
  applyTheme();
  ensureIdentity().then(ok => { 
    if (ok) {
      Promise.all([loadPoints(), loadMemory(), loadReminders(), loadSafety(), refreshHistory()]);
      if (!state.isGuest) $('logout-sidebar-btn').hidden = false;
    }
  });
})();
