const form = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const status = document.getElementById('login-status');
const submitButton = document.getElementById('login-submit');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!usernameInput || !passwordInput || !status || !submitButton) return;

  status.textContent = '';
  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');

  try {
    const response = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success || !data.token) {
      status.textContent = data.message || data.error || 'Unable to sign in. Check your credentials and try again.';
      return;
    }

    localStorage.setItem('kurukoo_admin', data.token);
    window.location.assign('/admin/');
  } catch {
    status.textContent = 'Unable to reach the admin service. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute('aria-busy');
  }
});
