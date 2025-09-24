module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  // ESM is enabled through package.json ("type": "module"). We keep transform empty to leverage native vm-modules when using the test script.
  collectCoverageFrom: [
    '<rootDir>/server.js',
    '<rootDir>/js/back-end/**/*.js',
    '<rootDir>/js/validation/**/*.js',
    '!<rootDir>/js/front-end/**',
    '!<rootDir>/js/**/node_modules/**',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Usar Babel para transformar arquivos ESM
  transform: { '^.+\\.js$': 'babel-jest' },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1'
  },
  testTimeout: 10000,
  verbose: true,
  moduleFileExtensions: ['js','json','node'],
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};