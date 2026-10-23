/* global __dirname */
const { join, relative, resolve } = require('node:path');

function gradleScriptLine(projectRoot, filename) {
  // 루트 Expo와 모바일 Expo가 생성하는 Android 폴더의 깊이가 다르다.
  const path = relative(
    join(projectRoot, 'android'),
    resolve(__dirname, '../../../scripts/android', filename),
  ).replace(/\\/g, '/');
  return `apply from: new File(rootProject.projectDir, ${JSON.stringify(path)})`;
}

function appendGradleScript(config, filename, reason) {
  const line = gradleScriptLine(config.modRequest.projectRoot, filename);
  const initialize = gradleScriptLine(
    config.modRequest.projectRoot,
    'repository-root.gradle',
  );
  const contents = config.modResults.contents;
  if (contents.includes(line) && contents.includes(initialize)) return config;
  // 이전 경로가 남은 네이티브 프로젝트에 같은 스크립트를 이중 적용하지 않는다.
  const retained = contents
    .split(/\r?\n/)
    .filter(
      (entry) =>
        !(entry.trim().startsWith('apply from:') && entry.includes(filename)),
    )
    .join('\n');
  return {
    ...config,
    modResults: {
      ...config.modResults,
      contents: `${retained}\n${contents.includes(initialize) ? '' : initialize + '\n'}// ${reason}\n${line}\n`,
    },
  };
}

module.exports = { gradleScriptLine, appendGradleScript };
