/* global __dirname */
const { resolve } = require('node:path');

// Playwright의 CommonJS 로더와 Node ESM 도구가 같은 기준 경로를 사용한다.
const repositoryRoot = resolve(__dirname, '../..');

function repositoryPath(...segments) {
  return resolve(repositoryRoot, ...segments);
}

function androidBuildOutput(environment = process.env) {
  return environment.TRIPPRINT_BUILD_OUTPUT_DIR
    ? resolve(repositoryRoot, environment.TRIPPRINT_BUILD_OUTPUT_DIR)
    : repositoryPath('outputs/android');
}

module.exports = { repositoryRoot, repositoryPath, androidBuildOutput };
