const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    setupFilesAfterEnv: ['<rootDir>/jest-sa11y-setup.js'],
    coverageThreshold: { global: { branches: 70, functions: 80, lines: 80, statements: 80 } }
};
