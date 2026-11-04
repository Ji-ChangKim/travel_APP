import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { repositoryPath } from '../../scripts/shared/repository-paths.cjs';

const require = createRequire(import.meta.url);
const config = require('../../apps/mobile/metro.config.js');
const blocked = (relative) => {
  const absolute = repositoryPath(relative).replaceAll('\\', '/');
  return config.resolver.blockList.some((pattern) => pattern.test(absolute));
};

test('Metro는 생성물을 감시에서 제외하고 앱·공유 패키지·자산을 유지한다', () => {
  for (const generated of [
    'outputs/preview/index.js',
    'apps/mobile/android/app/build/generated/index.js',
    'apps/mobile/.release/web/index.js',
    'node_modules/react-native-reanimated/android/build/generated/index.js',
    'node_modules/react-native-worklets/android/.cxx/Debug/index.js',
  ])
    assert.equal(blocked(generated), true, generated);
  for (const source of [
    'apps/mobile/src/app/index.tsx',
    'apps/mobile/src/features/auth/ui/WelcomeScreen.tsx',
    'packages/domain/src/index.ts',
    'apps/mobile/assets/brand/tripprint-v1/tripprint-app-icon-source.png',
    'node_modules/react-native/Libraries/Utilities/Platform.android.js',
  ])
    assert.equal(blocked(source), false, source);
});
