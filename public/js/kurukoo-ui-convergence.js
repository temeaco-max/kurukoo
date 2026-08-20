(() => {
  const tooltipTargetSelector = 'button[aria-label],a[aria-label],[role="button"][aria-label]';

  function decorateTooltips(root = document) {
    root.querySelectorAll(tooltipTargetSelector).forEach((el) => {
      const label = el.getAttribute('aria-label')?.trim();
      if (!label || el.getAttribute('data-tooltip')) return;
      el.setAttribute('data-tooltip', label);
      if (!el.getAttribute('title')) el.setAttribute('title', label);
    });
  }

  function setSidebarState(sidebar, collapsed, storageKey) {
    sidebar.classList.toggle('is-collapsed', collapsed);
    sidebar.dataset.collapsed = collapsed ? 'true' : 'false';
    localStorage.setItem(storageKey, collapsed ? '1' : '0');
    const toggle = sidebar.querySelector('#workspace-collapse, #sidebar-collapse');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      toggle.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      toggle.setAttribute('data-tooltip', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      const use = toggle.querySelector('use');
      if (use) use.setAttribute('href', collapsed ? '/icons/kurukoo-icons.svg#chevron-right' : '/icons/kurukoo-icons.svg#chevron-left');
    }
  }

  function bindWorkspaceSidebar() {
    const sidebar = document.getElementById('workspace-sidebar');
    if (!sidebar) return;
    const storageKey = 'kurukoo.workspace.sidebar.collapsed';
    const saved = localStorage.getItem(storageKey) === '1';
    setSidebarState(sidebar, saved, storageKey);
    sidebar.querySelector('#workspace-collapse')?.addEventListener('click', () => {
      setSidebarState(sidebar, !sidebar.classList.contains('is-collapsed'), storageKey);
    });
  }

  function bindMoreMenus() {
    const toggle = document.getElementById('workspace-more');
    const items = document.getElementById('workspace-more-items');
    if (toggle && items) {
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        toggle.classList.toggle('is-open', !open);
        items.hidden = open;
      });
    }
    const chatMore = document.getElementById('sidebar-more-toggle');
    const chatItems = document.getElementById('sidebar-more-items');
    if (chatMore && chatItems) {
      chatMore.addEventListener('click', () => {
        const open = chatMore.getAttribute('aria-expanded') === 'true';
        chatMore.setAttribute('aria-expanded', String(!open));
        chatItems.hidden = open;
        chatMore.classList.toggle('is-open', !open);
      });
    }
  }

  function addWorkspaceChatDock() {
    if (!document.body.classList.contains('workspace-page') || document.body.classList.contains('k-app-page') || document.querySelector('.workspace-chat-dock')) return;
    const dock = document.createElement('div');
    dock.className = 'workspace-chat-dock';
    dock.innerHTML = `
      <span class="workspace-chat-dock-label">Conversation stays connected to this page.</span>
      <button class="dock-collapse" type="button" aria-label="Hide Ask shortcut"><svg class="k-icon" aria-hidden="true"><use href="/icons/kurukoo-icons.svg#close"></use></svg></button>
      <a href="/chat" aria-label="Open conversation"><img src="/assets/brand/logo-icon.png" alt="" width="18" height="18"> Ask Kurukoo</a>`;
    document.body.appendChild(dock);
    dock.querySelector('.dock-collapse')?.addEventListener('click', () => {
      dock.classList.add('is-minimized');
      localStorage.setItem('kurukoo.workspace.chatDockHidden', '1');
    });
    if (localStorage.getItem('kurukoo.workspace.chatDockHidden') === '1') dock.classList.add('is-minimized');
  }

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const target = document.querySelector('#message-input, .workspace-page .ask-cta');
        if (target instanceof HTMLElement) target.focus();
      }
      if (event.key === 'Escape') {
        document.querySelectorAll('[aria-expanded="true"][aria-controls]').forEach((el) => {
          if (el instanceof HTMLElement) el.click();
        });
      }
    });
  }

  function run() {
    decorateTooltips();
    bindWorkspaceSidebar();
    bindMoreMenus();
    addWorkspaceChatDock();
    bindKeyboardShortcuts();
    const observer = new MutationObserver(() => decorateTooltips());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();