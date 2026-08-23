import { copyFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findNamedAttachment(manifest, expectedName) {
  const matches = [];

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const humanName = [value.suggestedHumanReadableName, value.name, value.filename].find(
      (candidate) => (typeof candidate === 'string' ? candidate.includes(expectedName) : false)
    );
    if (humanName && typeof value.exportedFileName === 'string') {
      matches.push(value.exportedFileName);
    }

    Object.values(value).forEach(visit);
  }

  visit(manifest);
  const uniqueMatches = [...new Set(matches)];
  if (uniqueMatches.length !== 1) {
    throw new Error(
      `Expected exactly one ${expectedName} attachment, found ${uniqueMatches.length}`
    );
  }

  return uniqueMatches[0];
}

export function exportNamedAttachment({
  manifestPath,
  attachmentsDirectory,
  outputPath,
  expectedName,
}) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const exportedFileName = findNamedAttachment(manifest, expectedName);
  const attachmentsRoot = realpathSync(attachmentsDirectory);
  const requestedSourcePath = resolve(attachmentsRoot, exportedFileName);
  const requestedRelativePath = relative(attachmentsRoot, requestedSourcePath);

  if (
    requestedRelativePath.startsWith('..') ||
    requestedRelativePath === '' ||
    !existsSync(requestedSourcePath)
  ) {
    throw new Error(`Unsafe or missing exported attachment: ${exportedFileName}`);
  }

  const sourcePath = realpathSync(requestedSourcePath);
  const sourceRelativePath = relative(attachmentsRoot, sourcePath);
  if (sourceRelativePath.startsWith('..') || sourceRelativePath === '') {
    throw new Error(`Exported attachment escapes its directory: ${exportedFileName}`);
  }

  copyFileSync(sourcePath, outputPath);
  return sourcePath;
}

function main() {
  const [manifestPath, outputPath, expectedName = 'cedarling-ui-success'] = process.argv.slice(2);
  if (!manifestPath || !outputPath) {
    throw new Error(
      'Usage: node scripts/export-ios-success-screenshot.mjs <manifest.json> <output.png> [attachment-name]'
    );
  }

  const sourcePath = exportNamedAttachment({
    manifestPath,
    attachmentsDirectory: dirname(manifestPath),
    outputPath,
    expectedName,
  });
  console.log(`Exported ${sourcePath} to ${outputPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
