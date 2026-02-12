module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^react-native-cmd-run$': '<rootDir>/__mocks__/react-native-cmd-run.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
