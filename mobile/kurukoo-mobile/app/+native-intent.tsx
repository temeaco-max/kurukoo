const TAB_ROUTES: Record<string, string> = {
  '/home': '/(tabs)',
  '/desk': '/(tabs)',
  '/chat': '/(tabs)',
  '/explore': '/(tabs)/discover',
  '/discover': '/(tabs)/discover',
  '/activity': '/(tabs)/requests',
  '/requests': '/(tabs)/requests',
  '/tasks': '/(tabs)/tasks',
  '/connect': '/(tabs)/connect',
};

function stripOrigin(path: string): string {
  try {
    const url = new URL(path, 'https://kurukoo.local');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path.startsWith('/') ? path : `/${path}`;
  }
}

/**
 * Resolve Kurukoo's canonical web addresses into the native Expo Router tree.
 *
 * Native navigation is a platform presentation of the same product resources;
 * it follows the assistant-first web vocabulary while preserving legacy aliases
 * for previously shared links.
 */
export function redirectSystemPath({ path }: { path: string; initial?: boolean }): string {
  const pathname = stripOrigin(path).split(/[?#]/, 1)[0] || '/';

  const direct = TAB_ROUTES[pathname];
  if (direct) return direct;

  if (/^\/chat\//.test(pathname) || /^\/share\//.test(pathname)) return '/(tabs)';
  if (/^\/(?:requests|activity)\//.test(pathname)) return '/(tabs)/requests';
  if (/^\/tasks\//.test(pathname)) return '/(tabs)/tasks';
  if (/^\/connections\//.test(pathname)) return '/(tabs)/connect';

  return '/(tabs)/more';
}
