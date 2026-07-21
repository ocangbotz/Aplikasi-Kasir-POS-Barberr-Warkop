const test = require('node:test');
const assert = require('node:assert/strict');

test('chart-labels.js: formatDayLabel, formatMonthLabel, formatYearLabel', async () => {
  const { formatDayLabel, formatMonthLabel, formatYearLabel } = await import('../../frontend/js/core/chart-labels.js');

  assert.equal(formatDayLabel('2026-07-21'), '21 Jul');
  assert.equal(formatDayLabel('2026-01-05'), '5 Jan');
  assert.equal(formatMonthLabel('2026-07'), 'Jul');
  assert.equal(formatMonthLabel('2026-12'), 'Des');
  assert.equal(formatYearLabel('2026'), '2026');
});
