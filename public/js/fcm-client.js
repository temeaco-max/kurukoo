(() => {
  const SDK_VERSION = '12.17.0';
  const CONFIG_ENDPOINT = '/api/fcm/config';
  const REGISTER_ENDPOINT = '/api/fcm/register';
  const DEVICE_KEY = 'kurukoo_fcm_device_id';
  let status = 'idle';
  let messagingPromise = null;

  const readDeviceId = () => {
    try {
      const existing = window.localStorage.getItem(DEVICE_KEY);
      if (existing) return existing;
      const generated = window.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(DEVICE_KEY, generated);
      return generated;
    } catch {
      return `web-${Date.now()}`;
    }
  };

  const loadFirebase = async (config) => {
    if (!messagingPromise) {
      messagingPromise = Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging.js`),
      ]).then(([appModule, messagingModule]) => {
        const app = appModule.initializeApp(config);
        const messaging = messagingModule.getMessaging(app);
        return { app, messagingModule, messaging };
      });
    }
    return messagingPromise;
  };

  const loadConfig = async () => {
    const response = await fetch(CONFIG_ENDPOINT, { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error(`Firebase config request failed (${response.status})`);
    return response.json();
  };

  const registerToken = async (token, config) => {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        deviceId: readDeviceId(),
        credentialType: 'pwa',
        label: 'Kurukoo Web/PWA notifications',
        platform: 'web',
        projectId: config?.config?.projectId,
      }),
    });
    if (!response.ok) throw new Error(`FCM registration failed (${response.status})`);
    return response.json();
  };

  const registerIfPermitted = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return { status: 'unsupported' };

    status = 'checking';
    const config = await loadConfig();
    if (!config?.configured || !config?.config) {
      status = 'unconfigured';
      return { status, reason: config?.reason };
    }

    if (Notification.permission !== 'granted') {
      status = Notification.permission === 'denied' ? 'denied' : 'permission_required';
      return { status };
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    const firebase = await loadFirebase(config.config);
    const token = await firebase.messagingModule.getToken(firebase.messaging, {
      vapidKey: config.config.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      status = 'token_unavailable';
      return { status };
    }

    const result = await registerToken(token, config);
    status = result?.tokenRegistered ? 'registered' : 'registration_uncertain';
    return { status, registration: result };
  };

  const enable = async () => {
    if (!('Notification' in window)) return { status: 'unsupported' };

    const config = await loadConfig();
    if (!config?.configured || !config?.config) {
      status = 'unconfigured';
      return { status, reason: config?.reason };
    }

    const permission = await Notification.requestPermission();
    status = permission === 'granted' ? 'granted' : permission;
    if (permission !== 'granted') return { status };
    return registerIfPermitted();
  };

  const installOptInControl = () => {
    if (!document.body?.classList.contains('k-app-page')) return;
    if (document.getElementById('kurukoo-enable-notifications')) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || Notification.permission !== 'default') return;

    const host = document.querySelector('.k-app-header-actions');
    if (!host) return;

    const button = document.createElement('button');
    button.id = 'kurukoo-enable-notifications';
    button.type = 'button';
    button.className = 'k-app-ask';
    button.textContent = 'Enable notifications';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Enabling…';
      try {
        const result = await enable();
        if (result.status === 'registered') {
          button.textContent = 'Notifications on';
          button.setAttribute('aria-label', 'Kurukoo notifications enabled');
          return;
        }
        button.textContent = result.status === 'denied' ? 'Notifications blocked' : 'Try notifications again';
        button.disabled = false;
      } catch (error) {
        status = 'error';
        console.warn('[Kurukoo FCM] permission/registration failed', error);
        button.textContent = 'Try notifications again';
        button.disabled = false;
      }
    });
    host.prepend(button);
  };

  const loadAppAssets = () => {
    if (!document.body?.classList.contains('k-app-page')) return;
    const assets = [
      ['kurukoo-app-convergence', '/js/kurukoo-app-convergence.js?v=tasks1'],
      ['kurukoo-app-extensions', '/js/kurukoo-app-extensions.js?v=1'],
    ];

    for (const [marker, src] of assets) {
      if (document.querySelector(`script[data-${marker}]`)) continue;
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.setAttribute(`data-${marker}`, '');
      document.head.appendChild(script);
    }
  };

  const attachForegroundListener = async () => {
    try {
      const firebase = await messagingPromise;
      if (!firebase?.messagingModule?.onMessage) return;

      firebase.messagingModule.onMessage(firebase.messaging, (payload) => {
        if (Notification.permission !== 'granted') return;

        const notification = payload?.notification || {};
        const data = payload?.data || {};
        const title = String(notification.title || data.title || 'Kurukoo');
        const body = String(notification.body || data.body || 'You have a new Kurukoo update.');
        const target = String(data.link || '/app/notifications');
        const notice = new Notification(title, {
          body,
          icon: '/assets/icons/icon-192.svg',
          data: { link: target },
        });

        notice.onclick = () => {
          window.focus();
          window.location.assign(target);
        };
      });
    } catch (error) {
      console.warn('[Kurukoo FCM] foreground listener unavailable', error);
    }
  };

  const boot = () => {
    loadAppAssets();

    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    installOptInControl();

    // Never prompt automatically. Re-register silently only after consent already exists.
    if (Notification.permission !== 'granted') return;

    registerIfPermitted()
      .then(() => attachForegroundListener())
      .catch((error) => {
        status = 'error';
        console.warn('[Kurukoo FCM] registration failed', error);
      });
  };

  window.kurukooFcm = {
    enable,
    registerIfPermitted,
    getStatus: () => status,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
