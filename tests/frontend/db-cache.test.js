const test = require('node:test');
const assert = require('node:assert/strict');

test('db-cache.js: isCacheEntryExpired (murni, tidak menyentuh indexedDB)', async () => {
  const { isCacheEntryExpired } = await import('../../frontend/js/core/db-cache.js');

  const now = 1_000_000;
  assert.equal(isCacheEntryExpired({ expiresAt: now + 1000 }, now), false);
  assert.equal(isCacheEntryExpired({ expiresAt: now - 1000 }, now), true);
  assert.equal(isCacheEntryExpired({ expiresAt: now }, now), true, 'tepat di waktu exp dianggap sudah kedaluwarsa');
  assert.equal(isCacheEntryExpired(null, now), true);
  assert.equal(isCacheEntryExpired({}, now), true, 'tanpa expiresAt dianggap kedaluwarsa');
});
