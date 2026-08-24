import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MINIMUM_LUMA_RANGE = 16;

export function parseSignalStats(output) {
  const minimumMatch = output.match(/lavfi\.signalstats\.YMIN=([\d.]+)/);
  const maximumMatch = output.match(/lavfi\.signalstats\.YMAX=([\d.]+)/);

  if (!minimumMatch || !maximumMatch) {
    throw new Error('FFmpeg did not report screenshot luma statistics');
  }

  return {
    minimum: Number(minimumMatch[1]),
    maximum: Number(maximumMatch[1]),
  };
}

export function requireVisibleImage(stats) {
  const range = stats.maximum - stats.minimum;
  if (!Number.isFinite(range) || range < MINIMUM_LUMA_RANGE) {
    throw new Error(
      `Screenshot has no visible contrast (YMIN=${stats.minimum}, YMAX=${stats.maximum})`
    );
  }

  return { ...stats, range };
}

function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    throw new Error('Usage: node scripts/verify-evidence-image.mjs <image>');
  }

  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'info',
      '-i',
      imagePath,
      '-vf',
      'signalstats,metadata=print',
      '-frames:v',
      '1',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' }
  );

  if (result.error) throw result.error;
  const diagnostics = `${result.stdout}\n${result.stderr}`;
  if (result.status !== 0) {
    throw new Error(`FFmpeg could not inspect the screenshot:\n${diagnostics}`);
  }

  const stats = requireVisibleImage(parseSignalStats(diagnostics));
  console.log(
    `Screenshot contrast verified: YMIN=${stats.minimum}, YMAX=${stats.maximum}, range=${stats.range}`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
