/**
 * router.js — router hash-based sederhana dengan role guard & param dinamis
 * (":id"). `compileRoutePath` & `matchPath` murni (tidak sentuh DOM) sehingga
 * diuji lewat Node; sisanya mengikat ke `window`/`document`.
 */

/** Ubah pola path (mis. "/transaksi/:id") jadi RegExp + daftar nama param. Murni. */
export function compileRoutePath(path) {
  const paramNames = [];
  const regexStr = path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

/** Cari route pertama yang cocok dengan pathname. Murni. routes: [{path, regex, paramNames, ...}]. */
export function matchPath(routes, pathname) {
  for (const route of routes) {
    const m = route.regex.exec(pathname);
    if (m) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1]);
      });
      return { route, params };
    }
  }
  return null;
}

const routes = [];
let containerEl = null;
let guardFn = () => true;
let onUnauthorized = () => {};
let onNotFound = () => {};

/**
 * Daftarkan route.
 * @param {string} path pola path, mis. "/", "/users", "/transaksi/:id"
 * @param {{render: Function, roles?: string[]|null, title?: string}} config
 */
export function registerRoute(path, config) {
  const { regex, paramNames } = compileRoutePath(path);
  routes.push({ path, regex, paramNames, roles: config.roles || null, render: config.render, title: config.title });
}

export function navigate(path) {
  window.location.hash = path;
}

function currentPath() {
  return window.location.hash.slice(1) || '/';
}

export async function renderCurrentRoute() {
  const path = currentPath();
  const matched = matchPath(routes, path);
  if (!matched) return onNotFound(containerEl);

  const { route, params } = matched;
  if (route.roles && !guardFn(route.roles)) return onUnauthorized(containerEl, route);

  document.title = route.title ? `${route.title} — POS Barber & Warkop` : 'POS Barber & Warkop';
  await route.render(containerEl, params);
}

/**
 * @param {{container: HTMLElement, guard: (roles:string[])=>boolean, unauthorized: Function, notFound: Function}} deps
 */
export function initRouter(deps) {
  containerEl = deps.container;
  guardFn = deps.guard;
  onUnauthorized = deps.unauthorized;
  onNotFound = deps.notFound;
  window.addEventListener('hashchange', renderCurrentRoute);
  return renderCurrentRoute();
}
