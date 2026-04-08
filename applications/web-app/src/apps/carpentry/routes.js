export const CARPENTRY_BASE_PATH = '/app/carpentry';

export function carpentryPath(segment = '') {
  const clean = String(segment || '').replace(/^\/+/, '');
  return clean ? `${CARPENTRY_BASE_PATH}/${clean}` : CARPENTRY_BASE_PATH;
}

export function stripCarpentryBase(pathname = '') {
  const path = String(pathname || '');
  if (path === CARPENTRY_BASE_PATH) return '/';
  if (path.startsWith(`${CARPENTRY_BASE_PATH}/`)) {
    return path.slice(CARPENTRY_BASE_PATH.length);
  }
  return path;
}
