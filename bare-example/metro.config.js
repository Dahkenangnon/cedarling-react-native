const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const defaultConfig = getDefaultConfig(__dirname);
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    blockList: [
      ...Array.from(defaultConfig.resolver.blockList ?? []),
      new RegExp(path.resolve(workspaceRoot, 'node_modules', 'react').replace(/\\/g, '\\\\')),
      new RegExp(
        path.resolve(workspaceRoot, 'node_modules', 'react-native').replace(/\\/g, '\\\\')
      ),
    ],
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    extraNodeModules: {
      'cedarling-react-native': workspaceRoot,
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
