module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.(t|j)sx?$',
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|scss|sass)$': '<rootDir>/jest.styleMock.js',
  },
};
