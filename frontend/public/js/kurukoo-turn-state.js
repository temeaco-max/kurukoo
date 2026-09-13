/* Kurukoo OS turn-state surface — shared, framework-free helper.
   Maps a running Chat/OS turn onto the canonical lifecycle grammar:
     ready (I can) → working (I'm working on it) → waiting → needs-you → done
   plus loading/spinner, offline/reconnect and returning-user banners.
   Presentation only; services remain the source of truth.
   Depends on window.KurukooAgentPresence (optional). */
(() => {
  const KNOWN_STAGES = ['ready','working','waiting','needs-you','done','completed','offline'];
  const STAGE_FOR_STATUS = {
    idle: 'ready', ready: 'ready', listening: 'ready',
    thinking: 'working', processing: 'working', working: 'working', speaking: 'working', typing: 'working',
    preparing: 'working', coordinating: 'working', checking: 'working', understanding: 'working', information: 'working',
    waiting: 'waiting', 'externally-pending': 'waiting', externally_pending: 'waiting', 'pending-external-evidence': 'waiting',
    'needs-user': 'needs-you', needs_user: 'needs-you', needsinput: 'needs-you', 'needs-input': 'needs-you',
    'needs-you': 'needs-you',
    confirmation_required: 'needs-you', confirmationrequired: 'needs-you',
    complete: 'done', done: 'done', success: 'done', completed: 'done',
    offline: 'offline'
  };
  const LABEL_FOR_STAGE = {
    ready: 'Ready',
    working: 'Kurukoo is working on this…',
    waiting: 'Waiting for the next step…',
    'needs-you': 'Kurukoo needs something from you',
    done: 'Done',
    completed: 'Done',
    offline: 'Connecting…'
  };
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function ensureBar(article) {
    if (!article) return null;
    let bar = article.querySelector('.message-turn-state');
    if (bar) return bar;
    bar = el('div', 'ko-turn-state message-turn-state');
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '';
    bar.append(
      el('span', 'ko-turn-state__spinner', ''),
      el('span', 'ko-turn-state__label', LABEL_FOR_STAGE.working)
    );
    // Insert above the bubble; assistants render with a bubble sibling.
    const bubble = article.querySelector('.bubble');
    if (bubble && bubble.parentNode === article) {
      article.insertBefore(bar, bubble);
    } else {
      article.insertBefore(bar, article.firstChild);
    }
    return bar;
  }

  function apply(bar, stage, label) {
    if (!bar) return;
    bar.dataset.stage = stage || 'ready';
    const labelEl = bar.querySelector('.ko-turn-state__label');
    if (labelEl) labelEl.textContent = label || LABEL_FOR_STAGE[stage] || 'Kurukoo';
  }

  function resolveStage(status) {
    const key = String(status || '').toLowerCase();
    if (KNOWN_STAGES.includes(key)) return key;
    if (STAGE_FOR_STATUS[key]) return STAGE_FOR_STATUS[key];
    return 'ready';
  }

  function setStatusOnArticle(article, status, label) {
    const bar = ensureBar(article);
    let stage = resolveStage(status);
    if (status === 'error' || status === 'failed') stage = 'needs-you';
    apply(bar, stage, label || LABEL_FOR_STAGE[stage] || 'Kurukoo');
  }

  function doneOnArticle(article) {
    const bar = ensureBar(article);
    apply(bar, 'done', 'Done');
    article.classList.add('message-done');
  }

  function clearBar(article) {
    const bar = article?.querySelector('.message-turn-state');
    if (bar) bar.remove();
  }

  function showReturningUser(target) {
    const container = target || document.getElementById('chat-content') || document.querySelector('.chat-shell');
    if (!container) return;
    if (container.querySelector('.ko-returning-user')) return;
    const banner = el('div', 'ko-returning-user');
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    const mark = el('span', 'ko-returning-user__mark', 'K');
    const text = el('span', 'ko-returning-user__text');
    text.textContent = 'Returning you to where you were. Your last request is below.';
    banner.append(mark, text);
    container.insertBefore(banner, container.firstChild);
    setTimeout(() => { banner.dataset.state = 'dismissed'; banner.style.opacity = '0'; }, 6000);
  }

  function showOffline(target) {
    const bar = ensureBar(target);
    apply(bar, 'offline', 'Trying to reconnect…');
  }

  window.KurukooTurnState = {
    mount: ensureBar,
    setStatus: setStatusOnArticle,
    done: doneOnArticle,
    clear: clearBar,
    showReturningUser,
    showOffline,
    resolveStage,
    STAGE_FOR_STATUS,
    LABEL_FOR_STAGE
  };
})();
