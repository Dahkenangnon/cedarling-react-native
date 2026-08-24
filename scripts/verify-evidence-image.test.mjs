import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSignalStats, requireVisibleImage } from './verify-evidence-image.mjs';

test('accepts a screenshot with visible contrast', () => {
  const stats = parseSignalStats(`
    lavfi.signalstats.YMIN=16
    lavfi.signalstats.YMAX=235
  `);

  assert.deepEqual(requireVisibleImage(stats), {
    minimum: 16,
    maximum: 235,
    range: 219,
  });
});

test('rejects a uniform black screenshot', () => {
  assert.throws(() => requireVisibleImage({ minimum: 16, maximum: 16 }), /no visible contrast/);
});

test('rejects missing FFmpeg signal statistics', () => {
  assert.throws(() => parseSignalStats('no frame metadata'), /did not report/);
});
