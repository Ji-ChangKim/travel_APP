const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const repositoryRoot = path.resolve(__dirname, '../..');

function directoryPattern(directory) {
  const normalized = path.resolve(directory).replaceAll('\\', '/');
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?:/|$)`);
}

const existing = config.resolver.blockList;
// Windows의 폴더별 감시가 네이티브 빌드·검수 생성물 때문에 시간 초과되지 않게 한다.
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  ...['outputs', 'output', 'scratch', '_workspace'].map((name) =>
    directoryPattern(path.join(repositoryRoot, name)),
  ),
  ...['android', 'ios', 'dist', '.release'].map((name) =>
    directoryPattern(path.join(__dirname, name)),
  ),
  /[/\\](?:\.gradle|\.cxx)(?:[/\\]|$)/,
  /[/\\]node_modules[/\\].*[/\\]android[/\\]build(?:[/\\]|$)/,
];

module.exports = config;
