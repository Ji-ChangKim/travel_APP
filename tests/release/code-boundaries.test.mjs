import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectCodeBoundary } from '../../scripts/checks/check-code-boundaries.mjs';

test('편집·공개 화면을 분리해도 통신과 렌더링의 경계를 유지한다', () => {
  for (const file of [
    'PlanEditorOptions.tsx',
    'PublicFeedFilters.tsx',
    'PublishSummary.tsx',
  ]) {
    assert.equal(
      inspectCodeBoundary(
        file,
        "import {getWorkspace} from '@wherego/api-client';",
      ).length,
      1,
    );
  }
  for (const file of [
    'workspaceEditorActions.ts',
    'useWorkspaceOperations.ts',
    'useWorkspaceData.ts',
  ]) {
    assert.equal(
      inspectCodeBoundary(
        file.replace(/\.ts$/, '.tsx'),
        'const content = <View />;',
      ).length,
      1,
    );
  }
});

test('분리한 화면·요청 행동·스타일에도 실행 의존성 경계를 적용한다', () => {
  // 실제 요청은 작업 모듈에서 허용하고 화면이나 스타일로 역류하면 실패한다.
  assert.deepEqual(
    inspectCodeBoundary(
      'workspaceMediaActions.ts',
      "import { requestFoundation } from '@wherego/api-client';",
    ),
    [],
  );
  assert.equal(
    inspectCodeBoundary(
      'RecordEditorScreenView.tsx',
      "import { getWorkspace } from '@wherego/api-client';",
    ).length,
    1,
  );
  assert.equal(
    inspectCodeBoundary('recordPersistence.tsx', 'const content = <View />;')
      .length,
    1,
  );
  assert.equal(
    inspectCodeBoundary(
      'profileEditorActions.ts',
      "import Text from '@/components/AppText';",
    ).length,
    1,
  );
  assert.equal(
    inspectCodeBoundary(
      'myAccountStyles.ts',
      "import { serverOptions } from './service';",
    ).length,
    1,
  );
  assert.deepEqual(
    inspectCodeBoundary(
      'RecordEditorScreenView.tsx',
      "import type { useRecordEditorController } from './useRecordEditorController';",
    ),
    [],
  );
  assert.equal(
    inspectCodeBoundary(
      'WorkspaceSections.tsx',
      "const save = () => command({ operation: 'schedule.save', input: {} });",
    ).length,
    1,
  );
});

test('한국어 포함 여부만으로 원시 예외를 신뢰하는 분기를 거부한다', () => {
  // 안전한 클라이언트 안내와 서버 원문을 언어로 구분하는 회귀를 막는다.
  assert.equal(
    inspectCodeBoundary(
      'apps/mobile/src/services/notice.ts',
      "const text = /[가-힣]/.test(error.message) ? error.message : '다시 시도';",
    ).length,
    1,
  );
});

test('운영 기본 주소는 거부하고 검토한 정적 사진은 해당 파일에서만 허용한다', () => {
  // 정적 자산 예외가 다른 파일이나 임의 배포 주소까지 허용하지 않게 한다.
  const asset =
    "const image = 'https://tripprint-staging.pages.dev/assets/destinations/taipei-101-tourism.jpg';";
  assert.deepEqual(
    inspectCodeBoundary(
      'apps/api/src/features/discovery/discoveryAssets.ts',
      asset,
    ),
    [],
  );
  assert.equal(
    inspectCodeBoundary(
      'apps/mobile/src/features/workspace/workspaceFailure.ts',
      asset,
    ).length,
    1,
  );
  assert.equal(
    inspectCodeBoundary(
      'apps/mobile/src/services/config.ts',
      "const api = 'https://api-trip.workers.dev';",
    ).length,
    1,
  );
});

test('표현 컴포넌트의 직접 API 의존성과 통신을 거부한다', () => {
  // 파일 분리 뒤 기능 처리를 다시 화면에 넣는 회귀를 검출한다.
  const findings = inspectCodeBoundary(
    'apps/mobile/src/features/workspace/WorkspaceView.tsx',
    "import { getWorkspace } from '@wherego/api-client'; fetch('/api');",
  );
  assert.equal(findings.length, 2);
});

test('표현 컴포넌트의 타입 참조는 허용하고 순수 기능의 JSX는 거부한다', () => {
  // 타입 경계를 실제 실행 의존성과 혼동하지 않는다.
  assert.deepEqual(
    inspectCodeBoundary(
      'apps/mobile/src/features/workspace/WorkspaceView.tsx',
      "import type { useWorkspaceController } from './useWorkspaceController';",
    ),
    [],
  );
  assert.equal(
    inspectCodeBoundary(
      'apps/mobile/src/features/workspace/workspaceDrafts.tsx',
      'const node = <View />;',
    ).length,
    1,
  );
});

test('스타일의 저장소 참조와 폐기 프로토타입 재도입을 거부한다', () => {
  // 정상 외부 링크와 운영 주소의 고정 기본값을 구분한다.
  assert.equal(
    inspectCodeBoundary(
      'apps/mobile/src/features/workspace/workspaceStyles.ts',
      "import { useTripStore } from '@/stores/useTripStore';",
    ).length,
    1,
  );
  assert.equal(
    inspectCodeBoundary(
      'apps/mobile/src/app/(tabs)/index.tsx',
      'export function MyTripsPrototypeScreen() {}',
    ).length,
    1,
  );
  assert.deepEqual(
    inspectCodeBoundary(
      'apps/mobile/src/features/workspace/map.ts',
      "const maps = 'https://www.google.com/maps/';",
    ),
    [],
  );
});
