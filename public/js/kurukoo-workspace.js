(() => {
  const qs = (selector) => document.querySelector(selector);
  const input = document.getElementById('message-input');
  const chatSidebar = document.getElementById('chat-sidebar');
  const workspaceSidebar = document.getElementById('workspace-sidebar');

  const seedPrompt = (prompt) => {
    if (!input || !prompt) return;
    input.value = prompt;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    chatSidebar?.classList.remove('open');
  };

  const toggleChatSidebar = (open) => {
    if (!chatSidebar) return;
    chatSidebar.classList.toggle('open', open);
    qs('#open-sidebar')?.setAttribute('aria-expanded', String(open));
  };

  qs('#open-sidebar')?.addEventListener('click', () => toggleChatSidebar(true));
  qs('#close-sidebar')?.addEventListener('click', () => toggleChatSidebar(false));

  qs('#sidebar-collapse')?.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('chat-sidebar-collapsed');
    localStorage.setItem('kurukoo_chat_sidebar_collapsed', collapsed ? '1' : '0');
  });
  if (localStorage.getItem('kurukoo_chat_sidebar_collapsed') === '1') document.body.classList.add('chat-sidebar-collapsed');

  qs('#workspace-collapse')?.addEventListener('click', () => {
    const collapsed = workspaceSidebar?.classList.toggle('is-collapsed');
    localStorage.setItem('kurukoo_workspace_collapsed', collapsed ? '1' : '0');
  });
  if (workspaceSidebar && localStorage.getItem('kurukoo_workspace_collapsed') === '1') workspaceSidebar.classList.add('is-collapsed');

  qs('#workspace-open')?.addEventListener('click', () => workspaceSidebar?.classList.add('open'));
  workspaceSidebar?.addEventListener('click', (event) => {
    if (event.target.closest('a')) workspaceSidebar.classList.remove('open');
  });

  document.addEventListener('click', async (event) => {
    const promptTarget = event.target.closest('[data-prompt]');
    if (promptTarget) {
      const prompt = promptTarget.dataset.prompt || '';
      if (input && (promptTarget.closest('.workspace-nav') || promptTarget.closest('.quick-actions') || promptTarget.closest('.composer-quick-actions'))) {
        event.preventDefault();
        seedPrompt(prompt);
        return;
      }
    }

    const logout = event.target.closest('#workspace-logout');
    if (logout) {
      event.preventDefault();
      logout.disabled = true;
      try {
        const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        if (!response.ok) throw new Error('Logout failed');
        localStorage.removeItem('kurukoo_auth_token');
        localStorage.removeItem('kurukoo_user_phone');
        localStorage.removeItem('kurukoo_user_name');
        window.location.assign('/chat');
      } catch (_) {
        logout.disabled = false;
        window.location.assign('/login?return=%2Fchat');
      }
    }
  });

  const params = new URLSearchParams(window.location.search);
  const prompt = params.get('prompt');
  if (prompt && input) window.requestAnimationFrame(() => seedPrompt(prompt));
})();
