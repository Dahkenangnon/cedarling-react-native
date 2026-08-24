import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { exportNamedAttachment, findNamedAttachment } from './export-ios-success-screenshot.mjs';

test('finds and exports the named XCResult attachment', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cedarling-xcresult-'));
  const manifestPath = join(directory, 'manifest.json');
  const attachmentPath = join(directory, 'attachment-uuid.png');
  const outputPath = join(directory, 'success.png');
  const manifest = [
    {
      attachments: [
        {
          exportedFileName: 'attachment-uuid.png',
          suggestedHumanReadableName: 'cedarling-ui-success_0_9E52C841-09D9-4E74.png',
        },
      ],
    },
  ];

  writeFileSync(manifestPath, JSON.stringify(manifest));
  writeFileSync(attachmentPath, 'png fixture');
  exportNamedAttachment({
    manifestPath,
    attachmentsDirectory: directory,
    outputPath,
    expectedName: 'cedarling-ui-success',
  });

  assert.equal(readFileSync(outputPath, 'utf8'), 'png fixture');
});

test('rejects missing or ambiguous named attachments', () => {
  assert.throws(() => findNamedAttachment([], 'cedarling-ui-success'), /found 0/);
  assert.throws(
    () =>
      findNamedAttachment(
        [
          {
            suggestedHumanReadableName: 'cedarling-ui-success-a.png',
            exportedFileName: 'a.png',
          },
          {
            suggestedHumanReadableName: 'cedarling-ui-success-b.png',
            exportedFileName: 'b.png',
          },
        ],
        'cedarling-ui-success'
      ),
    /found 2/
  );
});
