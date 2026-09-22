// Expo 권장 규칙을 적용하고 코드 서식은 Prettier에서 검사한다.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    ignores: [
      '**/dist/**',
      '**/.expo/**',
      '**/expo-env.d.ts',
      '**/node_modules/**',
    ],
  },
  expoConfig,
  prettierConfig,
]);
