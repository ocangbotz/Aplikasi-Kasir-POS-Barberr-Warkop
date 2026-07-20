const test = require('node:test');
const assert = require('node:assert/strict');

test('auth.js: hasRole (murni, tidak menyentuh localStorage)', async () => {
  const { hasRole } = await import('../../frontend/js/core/auth.js');

  assert.equal(hasRole({ role: 'Owner' }, ['Owner', 'Admin']), true);
  assert.equal(hasRole({ role: 'Kasir' }, ['Owner', 'Admin']), false);
  assert.equal(hasRole(null, ['Owner']), false);
  assert.equal(hasRole({ role: 'Owner' }, null), false);
  assert.equal(hasRole({ role: 'Capster' }, ['Owner', 'Admin', 'Kasir', 'Capster']), true);
});
