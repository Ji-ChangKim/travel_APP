// Expo 권장 규칙을 적용하고 코드 서식은 Prettier에서 검사한다.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    ignores: [
      // 검수 번들과 임시 Metro 캐시는 제품 소스 검사에서 제외한다.
      'outputs/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.wrangler/**',
      '**/.release/**',
      '**/expo-env.d.ts',
      '**/node_modules/**',
      'docs/98. keys/**',
    ],
  },
  expoConfig,
  prettierConfig,
]);
