(() => {
  const form = document.getElementById('auth-phone-form');
  const otpForm = document.getElementById('auth-otp-form');
  const profileForm = document.getElementById('auth-profile-form');
  const feedback = document.getElementById('auth-feedback');
  const phoneInput = document.getElementById('auth-phone');
  const prefixInput = document.getElementById('auth-prefix');
  const otpInput = document.getElementById('auth-otp');
  const nameInput = document.getElementById('auth-name');
  const emailInput = document.getElementById('auth-email');
  const goalInput = document.getElementById('auth-goal');
  const requestedPhone = document.getElementById('auth-requested-phone');
  const returnInput = document.getElementById('auth-return');
  const guestPhoneInput = document.getElementById('auth-guest-phone');
  const conversationIdInput = document.getElementById('auth-conversation-id');
  let verifiedPhone = '';

  const show = (message, success = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.classList.toggle('success', success);
    feedback.textContent = message;
  };

  const normalizePhone = () => {
    const prefix = prefixInput?.value || '+234';
    let local = String(phoneInput?.value || '').replace(/[^0-9]/g, '');
    if (local.startsWith('0')) local = local.slice(1);
    return `${prefix}${local}`;
  };

  const safeReturnTo = () => {
    const raw = String(returnInput?.value || '/chat');
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return '/chat';
      if (!url.pathname.startsWith('/')) return '/chat';
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_) { return '/chat'; }
  };

  const setStep = (step) => {
    document.querySelectorAll('[data-auth-step]').forEach((el) => { el.hidden = el.dataset.authStep !== step; });
  };

  const submitButton = (formEl, disabled) => {
    const button = formEl?.querySelector('button[type="submit"]');
    if (button) button.disabled = disabled;
  };

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const phone = normalizePhone();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      show('Enter a valid phone number so Kurukoo can securely verify your identity.');
      return;
    }
    submitButton(form, true);
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ phone })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'We could not send the verification code.');
      verifiedPhone = phone;
      if (requestedPhone) requestedPhone.textContent = phone;
      setStep('otp');
      show('Verification code sent. Enter it to continue.', true);
      otpInput?.focus();
    } catch (error) {
      show(error.message || 'We could not send the verification code.');
    } finally { submitButton(form, false); }
  });

  otpForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = String(otpInput?.value || '').replace(/\D/g, '').slice(0, 8);
    if (!verifiedPhone || code.length < 4) { show('Enter the verification code you received.'); return; }
    submitButton(otpForm, true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({
          phone: verifiedPhone,
          code,
          guestPhone: String(guestPhoneInput?.value || '') || undefined,
          conversationId: String(conversationIdInput?.value || '') || undefined,
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'That code could not be verified.');
      verifiedPhone = data.phone || verifiedPhone;
      localStorage.setItem('kurukoo_user_phone', verifiedPhone);
      if (data.token) localStorage.setItem('kurukoo_auth_token', data.token);
      setStep('profile');
      show('You are verified. Add a name or email if you want Kurukoo to remember them.', true);
      nameInput?.focus();
    } catch (error) { show(error.message || 'Verification failed.'); }
    finally { submitButton(otpForm, false); }
  });

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('kurukoo_auth_token');
    const body = { phone: verifiedPhone, name: nameInput?.value.trim() || '', email: emailInput?.value.trim() || '', goal: goalInput?.value || 'buyer' };
    submitButton(profileForm, true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: 'same-origin',
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || data.message || 'Profile setup could not be completed.');
      localStorage.setItem('kurukoo_user_phone', data.phone || verifiedPhone);
      if (body.name) localStorage.setItem('kurukoo_user_name', body.name);
      if (body.email) localStorage.setItem('kurukoo_user_email', body.email);
      localStorage.setItem('kurukoo_user_goal', body.goal);
      window.location.assign(safeReturnTo());
    } catch (error) { show(error.message || 'Could not finish setup.'); }
    finally { submitButton(profileForm, false); }
  });

  document.querySelector('[data-auth-back]')?.addEventListener('click', () => setStep('phone'));
  document.querySelector('[data-auth-skip-profile]')?.addEventListener('click', () => window.location.assign(safeReturnTo()));
  document.querySelector('[data-auth-logout]')?.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    localStorage.removeItem('kurukoo_auth_token');
    localStorage.removeItem('kurukoo_user_phone');
    localStorage.removeItem('kurukoo_user_name');
    localStorage.removeItem('kurukoo_user_email');
    window.location.assign('/');
  });

  const params = new URLSearchParams(window.location.search);
  if (returnInput) returnInput.value = params.get('return') || params.get('next') || '/chat';
})();
