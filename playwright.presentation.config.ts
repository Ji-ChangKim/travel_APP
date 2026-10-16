import { defineConfig } from '@playwright/test';
import schedule from './playwright.schedule.config';

// 다른 화면 작업의 검수 파일·서버를 덮어쓰지 않는 전용 환경이다.
export default defineConfig({
  ...schedule,
  grep: /표시·계층|P0 삭제 확인|여행 계획 개편:|항공편 목록:/,
  outputDir: '.release/presentation-test-results',
  use: { ...schedule.use, baseURL: 'http://127.0.0.1:8793' },
  webServer: {
    command: 'node scripts/preview-trail.mjs',
    url: 'http://127.0.0.1:8793/login',
    reuseExistingServer: false,
    env: {
      TRIPPRINT_PREVIEW_DIR: 'apps/mobile/.release/presentation-web',
      TRIPPRINT_PREVIEW_PORT: '8793',
    },
  },
});
