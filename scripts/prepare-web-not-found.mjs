import { copyFileSync } from 'node:fs';

// Pages의 잘못된 주소 요청에 Expo의 하루 오류 화면을 제공한다.
copyFileSync(
  new URL('../apps/mobile/dist/+not-found.html', import.meta.url),
  new URL('../apps/mobile/dist/404.html', import.meta.url),
);
