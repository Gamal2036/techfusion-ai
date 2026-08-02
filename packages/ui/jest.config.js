module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: '.',
  testRegex: '.*\\.test\\.(t|j)sx?$',
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
