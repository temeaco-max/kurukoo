(() => {
  const $ = (selector) => document.querySelector(selector);
  const input = document.getElementById('message-input');
  const sidebar = document.getElementById('chat-sidebar');

  function seedPrompt(prompt) {
    if (!input || !prompt) return;
    input.value = prompt;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    sidebar?.classList.remove('open');
  }

  document.addEventListener('click', async (event) => {
    const promptTarget = event.target.closest('[data-prompt]');
    if (promptTarget && promptTarget.closest('.workspace-nav')) {
      event.preventDefault();
      seedPrompt(promptTarget.dataset.prompt || '');
      return;
    }

    const logout = event.target.closest('#workspace-logout');
    if (logout) {
      event.preventDefault();
      logout.disabled = true;
      try {
        const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        if (!response.ok) throw new Error('Logout failed');
        window.location.assign('/');
      } catch (_) {
        logout.disabled = false;
        window.location.assign('/login?return=%2Fchat');
      }
    }
  });

  const params = new URLSearchParams(window.location.search);
  const prompt = params.get('prompt');
  if (prompt && input) {
    window.requestAnimationFrame(() => seedPrompt(prompt));
  }

  // Keep the workspace shell useful even when the main chat script is loaded later.
  $('#chat-sidebar')?.setAttribute('aria-expanded', 'true');
})();
