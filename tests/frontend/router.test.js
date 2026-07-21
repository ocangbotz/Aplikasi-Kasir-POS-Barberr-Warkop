const test = require('node:test');
const assert = require('node:assert/strict');

test('router.js: compileRoutePath & matchPath', async () => {
  const { compileRoutePath, matchPath } = await import('../../frontend/js/core/router.js');

  const routeHome = { path: '/', ...compileRoutePath('/'), roles: null };
  const routeUsers = { path: '/users', ...compileRoutePath('/users'), roles: ['Owner'] };
  const routeDetail = { path: '/transaksi/:id', ...compileRoutePath('/transaksi/:id'), roles: ['Owner'] };
  const routes = [routeHome, routeUsers, routeDetail];

  const matchedHome = matchPath(routes, '/');
  assert.equal(matchedHome.route, routeHome);
  assert.deepEqual(matchedHome.params, {});

  const matchedUsers = matchPath(routes, '/users');
  assert.equal(matchedUsers.route, routeUsers);

  const matchedDetail = matchPath(routes, '/transaksi/TRX-123');
  assert.equal(matchedDetail.route, routeDetail);
  assert.deepEqual(matchedDetail.params, { id: 'TRX-123' });

  const matchedDetailEncoded = matchPath(routes, '/transaksi/TRX%20123');
  assert.deepEqual(matchedDetailEncoded.params, { id: 'TRX 123' });

  assert.equal(matchPath(routes, '/tidak-ada'), null);
});

test('router.js: compileRoutePath tidak salah cocok path yang mirip tapi beda segmen', async () => {
  const { compileRoutePath, matchPath } = await import('../../frontend/js/core/router.js');
  const routeUsers = { ...compileRoutePath('/users'), roles: null };
  const routes = [routeUsers];
  assert.equal(matchPath(routes, '/users/123'), null, 'tidak boleh cocok karena ada segmen tambahan');
  assert.equal(matchPath(routes, '/user'), null);
});
