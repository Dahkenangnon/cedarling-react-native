import assert from 'node:assert/strict';
import test from 'node:test';

import { findNodeCenter } from './android-ui-bounds.mjs';

const hierarchy = `
<hierarchy>
  <node text="Run native smoke tests" resource-id="" bounds="[20,40][220,140]" />
  <node text="Wait" resource-id="android:id/aerr_wait" bounds="[70,1024][1010,1150]" />
</hierarchy>`;

test('finds a node center by exact text', () => {
  assert.deepEqual(findNodeCenter(hierarchy, 'text', 'Run native smoke tests'), {
    x: 120,
    y: 90,
  });
});

test('finds a system dialog action by resource ID', () => {
  assert.deepEqual(findNodeCenter(hierarchy, 'resource-id', 'android:id/aerr_wait'), {
    x: 540,
    y: 1087,
  });
});

test('returns null when the requested node is absent', () => {
  assert.equal(findNodeCenter(hierarchy, 'text', 'PASS'), null);
});

test('rejects unsupported attributes', () => {
  assert.throws(
    () => findNodeCenter(hierarchy, 'class', 'android.widget.Button'),
    /Unsupported Android UI attribute/
  );
});
