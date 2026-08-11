(() => {
  const state = {
    conversationId: localStorage.getItem('kurukoo_conversation_id') || '',
    messages: [], busy: false, attached: null,
    theme: localStorage.getItem('kurukoo_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    activeStorefrontId: null
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
    const sessionCheck = await fetch('/api/chat/history?limit=1', { credentials: 'same-origin' }).catch(() => null);
    if (sessionCheck?.ok) { setConnection(true); return true; }
    setConnection(false, sessionCheck?.status === 401 ? 'Sign in required' : 'Offline');
    if (sessionCheck?.status === 401) {
      if (isEmbed) {
        showEmbedSignInGate();
        return false;
      }
      const returnTo = `${location.pathname}${location.search}`;
      window.location.href = `/login?return=${encodeURIComponent(returnTo)}`;
    }
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
    const avatar = role === 'assistant' ? '<div class="avatar" aria-hidden="true">K</div>' : '';
    wrap.innerHTML = `${avatar}<div class="message-body"><div class="bubble"><div class="markdown-body"></div></div><div class="message-actions"></div></div>`;
    const bubble = wrap.querySelector('.markdown-body'); bubble.innerHTML = renderMarkdown(text); enhanceCode(wrap);
    const actions = wrap.querySelector('.message-actions');
    actions.innerHTML = role === 'assistant' ? '<button data-action="copy">Copy</button><button data-action="regenerate">Regenerate</button><button data-action="delete">Delete</button>' : '<button data-action="copy">Copy</button><button data-action="edit">Edit</button><button data-action="delete">Delete</button>';
    actions.addEventListener('click', async event => {
      const button = event.target.closest('button'); if (!button) return; const action = button.dataset.action;
      if (action === 'copy') await navigator.clipboard?.writeText(wrap.querySelector('.bubble').innerText);
      if (action === 'edit') { input.value = text; input.focus(); input.dispatchEvent(new Event('input')); }
      if (action === 'delete') { if (wrap.dataset.messageId) await deleteMessage(Number(wrap.dataset.messageId)); wrap.remove(); }
      if (action === 'regenerate') { const lastUser = [...state.messages].reverse().find(m => m.role === 'user'); if (lastUser) await sendMessage(lastUser.text); }
    });
    chatContent.appendChild(wrap); if (cardData) renderCard(cardData, wrap); scroll.scrollTop = scroll.scrollHeight; return wrap;
  }

  function appendStreamBubble() {
    $('welcome')?.remove(); const wrap = document.createElement('article'); wrap.className = 'message assistant';
    wrap.innerHTML = '<div class="avatar" aria-hidden="true">K</div><div class="message-body"><div class="bubble"><div class="markdown-body"></div><div class="thinking" hidden><details><summary>Reasoning completed</summary><div>Kurukoo selected the appropriate response path. Private model reasoning is not exposed.</div></details></div></div><div class="message-actions"><button data-action="copy">Copy</button><button data-action="regenerate">Regenerate</button><button data-action="delete">Delete</button></div></div>';
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
        status.textContent = '⏳ Request deferred — Kurukoo will re-check for a provider and notify you.';
      } else if (card.stage === 'fulfillment') {
        status.hidden = false;
        status.textContent = '🔒 Escrow locked. Confirm completion when the job is done.';
      } else if (card.stage === 'slot_fill' || card.stage === 'quote_review') {
        status.hidden = false;
        status.textContent = `🛒 Storefront · ${card.stage.replace(/_/g, ' ')} · ${card.progress || 0}%`;
      } else {
        status.hidden = true;
      }
      return;
    }
    if (!['worker_match','service_search','nearby_radar'].includes(card.type)) { status.hidden = true; return; }
    status.hidden = false;
    status.textContent = card.type === 'nearby_radar'
      ? '📡 Searching your shared Nearby Pulse for active providers…'
      : '🔎 Searching for a verified match. If none is available now, Kurukoo will keep the request open and notify you when a match appears.';
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

    if (Array.isArray(card.providers) && card.providers.length) {
      const providers = makeElement('ul', 'storefront-providers');
      card.providers.forEach((provider, index) => {
        const item = makeElement('li', index === 0 ? 'top' : '');
        const rating = Number(provider.rating || 0).toFixed(1);
        item.append(
          makeElement('strong', '', provider.name || 'Provider'),
          makeElement('span', '', `${rating}★ · ₦${String(provider.hourly_rate || 0)}`)
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

  function renderCard(card, messageEl) {
    if (!card || !messageEl) return;
    if (card.type === 'agentic_storefront') { renderAgenticStorefront(card, messageEl); return; }
    const holder = document.createElement('div');
    holder.className = 'provider-card';
    if (card.type === 'ride_picker') {
      holder.innerHTML = '<strong>Choose a ride</strong><div class="quick-actions"><button type="button">🚗 Okada</button><button type="button">🛺 Keke</button><button type="button">🚕 Taxi</button></div><span class="escrow-badge">🔒 Escrow Protected</span>';
      holder.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => sendMessage(`${btn.textContent.trim()} ride`)));
    } else if (card.type === 'worker_match' || card.type === 'service_search') {
      holder.innerHTML = `<strong>${card.category === 'food' ? 'Local food vendors' : 'Verified providers'}</strong><div class="deferred">Searching with your shared Memory Profile and real-time presence.</div><span class="escrow-badge">🔒 Escrow Protected</span>`;
    } else if (card.type === 'nearby_radar') {
      holder.innerHTML = '<strong>Nearby Pulse</strong><div class="deferred">Active providers will surface here as Kurukoo matches your request.</div>';
    } else if (card.type === 'sports_search') {
      holder.innerHTML = '<strong>Sports network</strong><div class="deferred">Searching leagues, teams, matches and nearby play.</div>';
    } else if (card.type === 'event_coverage') {
      holder.innerHTML = '<strong>Event Coverage</strong><div class="deferred">Contributor workflow ready: offer → accept → check-in → capture → moderation → payout.</div>';
    } else if (card.type === 'security_booking') {
      holder.innerHTML = '<strong>Vetted security</strong><span class="escrow-badge">🔒 Escrow Protected</span>';
    } else if (card.type === 'artist_booking') {
      holder.innerHTML = '<strong>Verified creator booking</strong><div class="deferred">Representation must be verified before Kurukoo presents a booking for confirmation.</div><span class="escrow-badge">🔒 Escrow Protected</span>';
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
    finally { state.busy = false; send.disabled = false; input.placeholder = 'Message Kurukoo'; input.focus(); loadPoints(); }
  }

  function updateModelStatus(data) { const label = $('model-badge'); if (label && data.model) label.textContent = data.model; }
  async function loadPoints() { try { const res = await fetch('/api/points/balance', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const points = Number(data.points || 0); const balance = $('points-balance')?.querySelector('span'); if (balance) balance.textContent = points; const ip = $('inspector-points'); if (ip) ip.textContent = points; } catch {} }
  async function loadMemory() { try { const res = await fetch('/api/profile', { credentials: 'same-origin' }); if (!res.ok) return; const data = await res.json(); const profile = data.profile || {}; const text = `Kurukoo remembers ${profile.location || 'your area'}${profile.primary_lga ? `, ${profile.primary_lga}` : ''}. Your Memory Profile is shared across channels.`; const mc = $('memory-context'); if (mc) mc.textContent = text; const im = $('inspector-memory'); if (im) im.textContent = text; } catch {} }

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
  $('open-sidebar')?.addEventListener('click', () => $('chat-sidebar')?.classList.add('open'));
  $('close-sidebar')?.addEventListener('click', () => $('chat-sidebar')?.classList.remove('open'));
  $('memory-toggle')?.addEventListener('click', () => $('chat-inspector')?.classList.toggle('open'));
  $('close-inspector')?.addEventListener('click', () => $('chat-inspector')?.classList.remove('open'));
  $('new-chat')?.addEventListener('click', async () => { if (!await ensureIdentity()) return; try { const res = await fetch('/api/chat/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ channel: 'web', title: 'New conversation' }) }); const data = await res.json(); if (data.conversationId) { state.conversationId = data.conversationId; localStorage.setItem('kurukoo_conversation_id', data.conversationId); } } catch {} state.messages = []; state.activeStorefrontId = null; chatContent.innerHTML = ''; const ds = $('deferred-status'); if (ds) ds.hidden = true; renderWelcome(); refreshHistory(); });
  $('topup-points')?.addEventListener('click', () => sendMessage('I want to top up my Points'));
  $('points-balance')?.addEventListener('click', () => sendMessage('Show my Points balance and ways to top up'));
  $('voice-input')?.addEventListener('click', () => { const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Recognition) return input?.focus(); const recognition = new Recognition(); recognition.lang = 'en-NG'; recognition.onresult = e => { if (input) { input.value = e.results[0][0].transcript; input.dispatchEvent(new Event('input')); } }; recognition.start(); });
  function renderWelcome() { chatContent.innerHTML = '<div class="welcome" id="welcome"><div class="welcome-mark">K</div><h1>What can I help you get done?</h1><p>One conversation for finding work, buying, earning, coordinating services, and everyday questions.</p><div class="quick-actions" id="quick-actions"><button data-prompt="Book a ride for me">🚗 Ride</button><button data-prompt="Order food near me">🍔 Food</button><button data-prompt="Find a verified repair worker">🔧 Repair</button><button data-prompt="I need emergency help">🏥 Emergency</button><button data-prompt="Help me find a way to earn">⚡ Earn</button></div></div>'; wireQuickActions($('quick-actions')); }
  applyTheme();
  ensureIdentity().then(ok => { if (ok) Promise.all([loadPoints(), loadMemory(), refreshHistory()]); });
})();
