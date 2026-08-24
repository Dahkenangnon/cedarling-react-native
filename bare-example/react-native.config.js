const path = require('path');

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: true,
    },
  },
  dependencies: {
    'cedarling-react-native': {
      root: path.resolve(__dirname, '..'),
      platforms: {
        ios: {},
        android: {},
      },
    },
  },
};
