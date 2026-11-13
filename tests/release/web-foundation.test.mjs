import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectCodeBoundary } from '../../scripts/checks/check-code-boundaries.mjs';

const webView = 'apps/web/src/features/home/HomePage.tsx';

test('웹의 모바일·API 내부 소스 직접 참조를 차단한다', () => {
  for (const dependency of [
    '../../../../mobile/src/stores/useTripStore',
    '../../../../api/src/infrastructure/backend',
    '@wherego/mobile',
  ]) {
    for (const statement of [
      `import { internal } from '${dependency}';`,
      `export * from '${dependency}';`,
      `import('${dependency}');`,
    ]) {
      const findings = inspectCodeBoundary(webView, statement);
      assert.equal(findings.length, 1, statement);
      assert.match(findings[0].rule, /공통 패키지와 API 계약/);
    }
  }
});

test('클라이언트의 별칭·상대 경로 서버 참조를 차단한다', () => {
  for (const dependency of [
    '@/server/session/readSession',
    '../../server/session/readSession',
  ]) {
    for (const statement of [
      `import { session } from '${dependency}';`,
      `export { session } from '${dependency}';`,
      `export * from '${dependency}';`,
      `import('${dependency}');`,
    ]) {
      const findings = inspectCodeBoundary(
        webView,
        `'use client'; ${statement}`,
      );
      assert.equal(findings.length, 1, statement);
      assert.match(findings[0].rule, /서버 전용 모듈/);
    }
  }
});

test('클라이언트의 타입 전용 참조는 실행 의존성으로 보지 않는다', () => {
  for (const statement of [
    "import type { Session } from '@/server/session';",
    "import { type Session } from '@/server/session';",
    "export type { Session } from '@/server/session';",
    "export { type Session } from '@/server/session';",
  ])
    assert.deepEqual(
      inspectCodeBoundary(webView, `'use client'; ${statement}`),
      [],
    );
});

test('웹의 공통 계약·자체 기능과 서버의 서버 모듈 연결을 허용한다', () => {
  assert.deepEqual(
    inspectCodeBoundary(
      webView,
      "import { Trip } from '@wherego/domain'; import { view } from './view';",
    ),
    [],
  );
  assert.deepEqual(
    inspectCodeBoundary(
      'apps/web/src/app/health/route.ts',
      "import { session } from '@/server/session/readSession';",
    ),
    [],
  );
});

test('기존 공개 브랜드·사진 자산 재사용은 허용하되 앱 코드는 차단한다', () => {
  assert.deepEqual(
    inspectCodeBoundary(
      'apps/web/src/shared/assets/siteAssets.ts',
      "import logo from '../../../../mobile/assets/brand/logo.png';",
    ),
    [],
  );
  assert.equal(
    inspectCodeBoundary(
      'apps/web/src/shared/assets/siteAssets.ts',
      "import code from '../../../../mobile/assets/unsafe.ts';",
    ).length,
    1,
  );
});
