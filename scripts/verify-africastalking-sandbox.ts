const apiKey = String(process.env.AFRICASTALKING_API_KEY || '').trim();
const username = String(process.env.AFRICASTALKING_USERNAME || '').trim();
const base = String(process.env.AFRICASTALKING_API_BASE || (username.toLowerCase() === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com')).replace(/\/$/, '');

if (!apiKey || !username || ['stub', 'placeholder'].includes(apiKey.toLowerCase())) {
  console.log(JSON.stringify({ configured: false, checked: false, reason: 'africastalking_credentials_not_available' }));
  process.exit(0);
}

try {
  const response = await fetch(`${base}/version1/user?username=${encodeURIComponent(username)}`, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', apiKey },
  });
  const text = await response.text();
  let payload: any = {}; try { payload = text ? JSON.parse(text) : {}; } catch { /* response remains intentionally opaque */ }
  console.log(JSON.stringify({ configured: true, checked: true, httpStatus: response.status, responseKeys: Object.keys(payload || {}).sort(), hasUserData: Boolean(payload?.UserData || payload?.userData) }));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.log(JSON.stringify({ configured: true, checked: false, error: error instanceof Error ? error.name : 'network_error' }));
  process.exit(1);
}
