const { spawnSync } = require('child_process');

// On Windows, executables like `tsc` and `jest` are `.cmd` batch files and cannot be
// spawned directly — they require shell: true to resolve. On Unix, shell: true is
// unnecessary.
function spawnSyncWithAutoShell(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    shell: process.platform === 'win32',
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

module.exports = { spawnSyncWithAutoShell };
