/* Canonical Web App state layer for reminders, cart, saved/economic controls and live handoffs. */
(function () {
  'use strict';
  const root = document.querySelector('[data-kurukoo-app]');
  if (!root) return;
  const section = root.dataset.appSection || '';
  const supported = ['reminders','cart','saved','wallet','subscriptions','checkout','confirmations','call'];
  if (!supported.includes(section)) return;
  const host = root.querySelector('.k-app-main .k-app-card');
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : { message: await response.text() };
    if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    return payload;
  };
  const announce = (message) => { let live = root.querySelector('[data-app-live]'); if (!live) { live = document.createElement('div'); live.className = 'k-sr-only'; live.dataset.appLive = ''; live.setAttribute('aria-live', 'polite'); root.appendChild(live); } live.textContent = message; };
  const button = (label, handler, primary = false) => { const b = document.createElement('button'); b.type = 'button'; b.className = primary ? 'k-app-primary' : 'k-app-card-action'; b.textContent = label; b.addEventListener('click', handler); return b; };
  const field = (labelText, type, name, value = '', placeholder = '') => { const label = document.createElement('label'); label.className = 'k-form'; const caption = document.createElement('span'); caption.textContent = labelText; const input = document.createElement(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') input.type = type; input.name = name; input.value = value; input.placeholder = placeholder; input.required = type !== 'textarea'; label.append(caption, input); return { label, input }; };
  const shell = (eyebrow, title, description) => { if (!host) return; host.innerHTML = `<span class="k-app-card-label">${eyebrow}</span><h2>${title}</h2><p class="k-muted">${description}</p>`; };

  async function loadReminders() {
    if (!host) return;
    shell('Reminders','Scheduled help that stays with your conversations.','Loading reminders…');
    try {
      const payload = await api('/api/reminders?includeCompleted=true');
      const reminders = Array.isArray(payload.reminders) ? payload.reminders : [];
      host.innerHTML = '<span class="k-app-card-label">Reminders</span><h2>Scheduled help that stays with your conversations.</h2>';
      const form = document.createElement('form'); form.className = 'k-form'; form.style.marginTop = '16px';
      const title = field('Reminder','text','title','','Call Mum'); const due = field('When','datetime-local','dueAt'); const note = field('Note (optional)','text','note','','What should Kurukoo remember?'); const submit = button('Create reminder',null,true); submit.type='submit';
      form.append(title.label,due.label,note.label,submit); form.addEventListener('submit',async event=>{event.preventDefault();if(!title.input.value.trim()||!due.input.value){announce('Reminder title and time are required.');return;}submit.disabled=true;try{await api('/api/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.input.value.trim(),dueAt:new Date(due.input.value).toISOString(),note:note.input.value.trim()||undefined})});announce('Reminder created.');form.reset();await loadReminders();}catch(error){submit.disabled=false;announce(error.message);}}); host.appendChild(form);
      const list=document.createElement('div');list.className='k-action-row';list.style.flexDirection='column';list.style.alignItems='stretch';list.style.marginTop='18px';
      if(!reminders.length){const p=document.createElement('p');p.className='k-muted';p.textContent='No reminders are currently stored.';list.appendChild(p);} else reminders.slice(0,20).forEach(reminder=>{const row=document.createElement('article');row.className='k-surface';row.style.padding='14px';const strong=document.createElement('strong');strong.textContent=reminder.title||'Reminder';const meta=document.createElement('p');meta.className='k-muted';meta.textContent=`${reminder.due_at||reminder.dueAt||'Scheduled'} · ${reminder.status||(reminder.completed?'completed':'active')}`;row.append(strong,meta);if(!['completed','cancelled','resolved'].includes(String(reminder.status||'').toLowerCase())&&reminder.id)row.appendChild(button('Cancel',async event=>{event.currentTarget.disabled=true;try{await api(`/api/reminders/${encodeURIComponent(reminder.id)}/cancel`,{method:'POST'});announce('Reminder cancelled.');await loadReminders();}catch(error){event.currentTarget.disabled=false;announce(error.message);}}));list.appendChild(row);});
      host.appendChild(list); host.appendChild(button('Manage reminders in Chat →',()=>window.location.assign('/chat?prompt=Show%20me%20my%20reminders'));
    } catch(error) { shell('Reminders','Reminders unavailable',error.message||'Reminder service is unavailable right now.'); }
  }

  async function loadCart() {
    if (!host) return;
    shell('Cart','Review sourced offers before any economic action.','Loading your review cart…');
    try {
      const payload=await api('/cart');const items=Array.isArray(payload.items)?payload.items:[];
      host.innerHTML='<span class="k-app-card-label">Cart</span><h2>Review sourced offers before any economic action.</h2><p class="k-muted">Cart is a review surface. It does not itself mean inventory, payment or fulfilment is confirmed.</p>';
      const list=document.createElement('div');list.className='k-action-row';list.style.flexDirection='column';list.style.alignItems='stretch';list.style.marginTop='16px';
      if(!items.length){const p=document.createElement('p');p.className='k-muted';p.textContent='Your review cart is empty.';list.appendChild(p);} else items.forEach(item=>{const row=document.createElement('article');row.className='k-surface';row.style.padding='16px';const title=document.createElement('strong');title.textContent=item.title||'Offer';const meta=document.createElement('p');meta.className='k-muted';meta.textContent=`${item.seller||'Seller unknown'} · Qty ${item.quantity||1} · ${item.price_minor!=null?`${item.currency||'NGN'} ${(Number(item.price_minor)/100).toFixed(2)}`:'Price pending'}`;const source=document.createElement('p');source.className='k-muted';source.textContent=`State: ${item.status||'review'}${item.request_id?` · Economic Request ${item.request_id}`:''}`;row.append(title,meta,source);const actions=document.createElement('div');actions.className='k-action-row';actions.appendChild(button('Remove',async event=>{event.currentTarget.disabled=true;try{await api(`/cart/items/${encodeURIComponent(item.id)}`,{method:'DELETE'});announce('Cart item removed.');await loadCart();}catch(error){event.currentTarget.disabled=false;announce(error.message);}}));if(!item.request_id)actions.appendChild(button('Connect to Economic Request',async event=>{event.currentTarget.disabled=true;try{const result=await api('/cart/checkout',{method:'POST'});announce(result.message||'Offer connected to Economic Request.');await loadCart();}catch(error){event.currentTarget.disabled=false;announce(error.message);}},true));else actions.appendChild(button('Review payment state',()=>window.location.assign('/app/checkout')));row.appendChild(actions);list.appendChild(row);});
      host.appendChild(list);const note=document.createElement('p');note.className='k-muted';note.style.marginTop='14px';note.textContent='External affiliate offers may require a verified external destination. Local payment is never claimed from the cart alone.';host.appendChild(note);host.appendChild(button('Continue in Chat →',()=>window.location.assign('/chat'),true));
    } catch(error) { shell('Cart','Cart unavailable',error.message||'Cart is unavailable right now.'); }
  }

  async function loadSaved() {
    if (!host) return;
    host.innerHTML='<span class="k-app-card-label">Saved & offers</span><h2>Your saved context stays with Kurukoo.</h2><p class="k-muted">The current canonical system does not expose a standalone saved/bookmark authority. Kurukoo keeps the action in the conversation and owner-scoped memory boundary instead of inventing a second store.</p>';
    const actions=document.createElement('div');actions.className='k-action-row';actions.appendChild(button('Ask for saved items →',()=>window.location.assign('/chat?prompt=Show%20me%20my%20saved%20items'),true));actions.appendChild(button('Open Memory →',()=>window.location.assign('/app/memory')));host.appendChild(actions);
  }

  async function loadWallet() {
    if(!host)return;host.innerHTML='<span class="k-app-card-label">Wallet</span><h2>Economic balances and payment evidence.</h2><p class="k-muted">Loading canonical balance and payment readiness…</p>';
    try{const [points,stripe]=await Promise.allSettled([api('/api/points/balance'),api('/api/payments/stripe/status')]);host.innerHTML='<span class="k-app-card-label">Wallet</span><h2>Economic balances and payment evidence.</h2>';const grid=document.createElement('div');grid.className='k-app-grid two';const pcard=document.createElement('article');pcard.className='k-app-stat';pcard.innerHTML='<span>Points</span><strong>Unavailable</strong>';if(points.status==='fulfilled')pcard.querySelector('strong').textContent=String(points.value.points??0);const scard=document.createElement('article');scard.className='k-app-stat';scard.innerHTML='<span>Stripe</span><strong>Unavailable</strong>';if(stripe.status==='fulfilled')scard.querySelector('strong').textContent=stripe.value.configured?'Configured':'Not configured';grid.append(pcard,scard);host.appendChild(grid);const actions=document.createElement('div');actions.className='k-action-row';actions.appendChild(button('Open Points →',()=>window.location.assign('/app/points')));actions.appendChild(button('Review Requests →',()=>window.location.assign('/app/requests')));host.appendChild(actions);
    }catch(error){const p=document.createElement('p');p.className='k-muted';p.textContent=error.message||'Wallet state is unavailable.';host.appendChild(p);}
  }

  async function loadSubscriptions() {
    if(!host)return;host.innerHTML='<span class="k-app-card-label">Subscriptions</span><h2>Plans and entitlements stay evidence-gated.</h2><p class="k-muted">Loading your current entitlement…</p>';
    try{const balance=await api('/api/points/balance');const tier=balance.tier||'Base';host.innerHTML='<span class="k-app-card-label">Subscriptions</span><h2>Plans and entitlements stay evidence-gated.</h2>';const current=document.createElement('article');current.className='k-surface';current.style.padding='16px';current.innerHTML=`<strong>Current tier: ${tier}</strong><p class="k-muted">A plan change is only applied after a canonical payment confirmation.</p>`;host.appendChild(current);const form=document.createElement('form');form.className='k-form';const label=document.createElement('label');label.className='k-form';label.innerHTML='<span>Plan</span>';const select=document.createElement('select');['Base','Plus','Business'].forEach(v=>{const o=document.createElement('option');o.value=v.toLowerCase();o.textContent=v;select.appendChild(o);});label.appendChild(select);const submit=button('Request plan change',null,true);submit.type='submit';form.append(label,submit);form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const result=await api('/subscription/upgrade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:select.value,country:'ng'})});announce(result.message||'Subscription change processed.');await loadSubscriptions();}catch(error){submit.disabled=false;announce(error.message);}});host.appendChild(form);
    }catch(error){const p=document.createElement('p');p.className='k-muted';p.textContent=error.message||'Subscription state is unavailable.';host.appendChild(p);}
  }

  async function loadCheckout() {
    if(!host)return;host.innerHTML='<span class="k-app-card-label">Checkout</span><h2>Confirm the Economic Request before payment.</h2><p class="k-muted">Loading your requests…</p>';
    try{const payload=await api('/api/chat/economic-requests');const requests=Array.isArray(payload.requests)?payload.requests:[];host.innerHTML='<span class="k-app-card-label">Checkout</span><h2>Confirm the Economic Request before payment.</h2>';const list=document.createElement('div');list.className='k-action-row';list.style.flexDirection='column';list.style.alignItems='stretch';const payable=requests.filter(r=>['quoted','awaiting_confirmation','payment_pending'].includes(r.status));if(!payable.length){const p=document.createElement('p');p.className='k-muted';p.textContent='No Economic Request currently requires payment.';list.appendChild(p);}else payable.slice(0,10).forEach(r=>{const row=document.createElement('article');row.className='k-surface';row.style.padding='16px';const title=document.createElement('strong');title.textContent=r.skill||r.category||'Economic Request';const quote=r.quote||{};const meta=document.createElement('p');meta.className='k-muted';meta.textContent=`${r.status} · ${quote.currency||''} ${quote.amount_minor!=null?(Number(quote.amount_minor)/100).toFixed(2):'quote pending'}`;row.append(title,meta);const actions=document.createElement('div');actions.className='k-action-row';if(r.status==='payment_pending'||r.status==='quoted'||r.status==='awaiting_confirmation')actions.appendChild(button('Start verified payment',async event=>{event.currentTarget.disabled=true;try{const result=await api('/api/payments/stripe/intents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({economicRequestId:r.id})});if(result.clientSecret){announce('Stripe payment session created. Continue in the originating payment surface.');window.location.assign(`/chat?prompt=${encodeURIComponent(`Continue payment for Economic Request ${r.id}`)}`);}else announce('Payment provider did not return a client secret.');}catch(error){event.currentTarget.disabled=false;announce(error.message);}},true));actions.appendChild(button('Open Request →',()=>window.location.assign(`/chat?prompt=${encodeURIComponent(`Continue my ${r.skill||r.category||'request'}`)}`)));row.appendChild(actions);list.appendChild(row);});host.appendChild(list);
    }catch(error){const p=document.createElement('p');p.className='k-muted';p.textContent=error.message||'Checkout state is unavailable.';host.appendChild(p);}
  }

  async function loadConfirmations() {
    if(!host)return;host.innerHTML='<span class="k-app-card-label">Confirmations</span><h2>Evidence, lifecycle and recovery.</h2><p class="k-muted">Loading canonical request history…</p>';
    try{const payload=await api('/api/chat/economic-requests');const requests=Array.isArray(payload.requests)?payload.requests:[];host.innerHTML='<span class="k-app-card-label">Confirmations</span><h2>Evidence, lifecycle and recovery.</h2><p class="k-muted">Only canonical state is shown; no local “success” flag is inferred.</p>';const list=document.createElement('div');list.className='k-action-row';list.style.flexDirection='column';list.style.alignItems='stretch';requests.slice(0,20).forEach(r=>{const row=document.createElement('article');row.className='k-surface';row.style.padding='14px';const title=document.createElement('strong');title.textContent=r.skill||r.category||'Request';const meta=document.createElement('p');meta.className='k-muted';meta.textContent=`${r.status||'unknown'}${r.id?` · ${r.id}`:''}`;row.append(title,meta,button('Continue →',()=>window.location.assign(`/chat?prompt=${encodeURIComponent(`Continue Economic Request ${r.id}`)}`)));list.appendChild(row);});if(!requests.length){const p=document.createElement('p');p.className='k-muted';p.textContent='No canonical request confirmations yet.';list.appendChild(p);}host.appendChild(list);
    }catch(error){const p=document.createElement('p');p.className='k-muted';p.textContent=error.message||'Confirmation state is unavailable.';host.appendChild(p);}
  }

  async function loadCall() {
    if(!host)return;host.innerHTML='<span class="k-app-card-label">Kurukoo Call</span><h2>Realtime voice remains one Kurukoo relationship.</h2><p class="k-muted">Checking call and voice readiness…</p>';
    const open=()=>window.location.assign('/call');
    try{const payload=await api('/api/voice/status');host.innerHTML='<span class="k-app-card-label">Kurukoo Call</span><h2>Realtime voice remains one Kurukoo relationship.</h2>';const status=document.createElement('div');status.className='k-surface';status.style.padding='16px';const state=payload.enabled||payload.available||payload.configured?'Ready':'Not currently available';status.innerHTML=`<strong>Voice: ${state}</strong><p class="k-muted">${payload.message||'Provider credentials and realtime infrastructure determine live activation.'}</p>`;host.append(status,button('Open Call →',open,true),button('Continue in Chat →',()=>window.location.assign('/chat')));
    }catch(error){host.innerHTML='<span class="k-app-card-label">Kurukoo Call</span><h2>Realtime voice readiness</h2>';const p=document.createElement('p');p.className='k-muted';p.textContent='The call authority did not expose a status response; opening the canonical Call surface is the truthful next step.';host.append(p,button('Open Call →',open,true));}
  }

  const loaders={reminders:loadReminders,cart:loadCart,saved:loadSaved,wallet:loadWallet,subscriptions:loadSubscriptions,checkout:loadCheckout,confirmations:loadConfirmations,call:loadCall};
  const start=()=>loaders[section]?.();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
