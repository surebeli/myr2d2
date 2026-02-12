const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const cmdRunPath = path.resolve(projectRoot, '..', 'packages', 'react-native-cmd-run');

const config = {
  projectRoot,
  watchFolders: [cmdRunPath],
  resolver: {
    disableHierarchicalLookup: true,
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    extraNodeModules: {
      'react-native-cmd-run': cmdRunPath,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
