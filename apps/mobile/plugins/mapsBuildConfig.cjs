/* global __dirname */
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// 지도 SDK 전용 키 하나만 읽고 다른 비밀 설정은 반환하지 않는다.
function readMapsAndroidKey(
  root = resolve(__dirname, '../../..'),
  env = process.env,
) {
  // Android Studio 빌드도 루트의 릴리스 설정을 같은 방식으로 사용한다.
  return cleanKey(
    env.GOOGLE_MAPS_ANDROID_API_KEY ||
      (existsSync(resolve(root, '.env.release'))
        ? readFileSync(resolve(root, '.env.release'), 'utf8').match(
            /^\s*GOOGLE_MAPS_ANDROID_API_KEY\s*=\s*(.*?)\s*$/m,
          )?.[1]
        : ''),
  );
}

// 키의 따옴표·주변 공백만 제거하고 예시나 잘못된 값을 사용하지 않는다.
function cleanKey(value = '') {
  // 유효한 키 형식만 네이티브 빌드에 전달한다.
  return /^AIza[A-Za-z0-9_-]{35}$/.test(
    value.trim().replace(/^(['"])(.*)\1$/, '$2'),
  )
    ? value.trim().replace(/^(['"])(.*)\1$/, '$2')
    : '';
}

module.exports = { readMapsAndroidKey };
