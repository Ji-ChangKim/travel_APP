import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getReleaseIssues,
  workerConfig,
} from '../../scripts/release-config.mjs';

const valid = {
  RELEASE_ENV: 'staging',
  RELEASE_WEB_ORIGIN: 'https://travel-stage.pages.dev',
  CLOUDFLARE_PAGES_PROJECT: 'travel-stage',
  EXPO_PUBLIC_BACKEND: 'cloudflare',
  EXPO_PUBLIC_API_URL: 'https://travel-stage.workers.dev',
  EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
    'https://travel-stage.pages.dev/auth/callback',
};

test('Cloudflare 공개 설정은 Supabase 키 없이 통과한다', () => {
  // 현재 앱의 백엔드와 공개 주소 계약만 검사한다.
  return assert.deepEqual(getReleaseIssues(valid), []);
});

test('공공데이터 키는 공개 배포 설정에 복사하지 않고 잘못된 공급자 설정은 거부한다', () => {
  // 서버 비밀 키와 공개 공급자 선택을 분리한다.
  assert.equal(
    JSON.stringify(
      workerConfig({ ...valid, KAC_FLIGHT_SERVICE_KEY: 'private-kac-key' }),
    ).includes('private-kac-key'),
    false,
  );
  assert.equal(
    getReleaseIssues({ ...valid, FLIGHT_LOOKUP_PROVIDER: 'unknown' }).some(
      (message) => {
        // 공급자 이름을 잘못 입력한 상태로 배포를 준비하지 않는다.
        return message.startsWith('FLIGHT_LOOKUP_PROVIDER:');
      },
    ),
    true,
  );
});

test('항공 조회 제한은 배포 환경별 namespace를 사용하고 서버 키를 공개하지 않는다', () => {
  // 생성 설정에서 로컬 제한 카운터를 잘못 재사용하지 않는다.
  const config = workerConfig({
    ...valid,
    AERODATABOX_RAPIDAPI_KEY: 'private-flight-secret',
  });
  assert.deepEqual(config.ratelimits, [
    {
      name: 'FLIGHT_LOOKUP_LIMITER',
      namespace_id: '100542',
      simple: { limit: 6, period: 60 },
    },
  ]);
  assert.equal(JSON.stringify(config).includes('private-flight-secret'), false);
});

test('Worker는 실제 D1·R2·AUTH_SECRET과 공개 주소만 사용한다', () => {
  // 서버 비밀은 설정 파일로 복사하지 않고 바인딩 이름으로만 유지한다.
  return assert.deepEqual(
    projectConfig(workerConfig({ ...valid, AUTH_SECRET: 'private-value' })),
    {
      name: 'tripprint-api-staging',
      vars: {
        FLIGHT_LOOKUP_PROVIDER: 'kac',
        AUTH_BASE_URL: valid.EXPO_PUBLIC_API_URL,
        ALLOWED_ORIGINS: valid.RELEASE_WEB_ORIGIN,
        SUPABASE_URL: '',
        SUPABASE_ANON_KEY: '',
      },
      database: 'DB',
      media: 'MEDIA',
      migrations: '../migrations',
      secrets: ['AUTH_SECRET'],
      env: undefined,
      keepVars: true,
    },
  );
});

test('누락·공백 OAuth 식별값은 기존 서버 로그인을 빈 값으로 덮어쓰지 않는다', () => {
  // 생성 설정의 변수 보존과 빈 식별값 제외를 함께 검사한다.
  return assert.deepEqual(
    projectConfig(workerConfig({ ...valid, GOOGLE_CLIENT_ID: '  ' })),
    projectConfig(workerConfig(valid)),
  );
});

// 배포 결과에서 실제 서버 연결에 필요한 항목만 비교한다.
test('SNS 공개 식별값은 배포에 유지하고 미등록 비밀 키를 필수로 강제하지 않는다', () => {
  // 키 등록 전에도 게스트·이메일을 배포할 수 있고 비밀 원문은 설정에서 제외한다.
  return checkSocialConfig(
    workerConfig({
      ...valid,
      GOOGLE_CLIENT_ID: 'google-client',
      KAKAO_CLIENT_ID: 'kakao-client',
      NAVER_CLIENT_ID: 'naver-client',
      NAVER_CLIENT_SECRET: 'private-provider-secret',
    }),
  );
});

// 생성 설정의 공개 키와 비밀 분리를 한 계약으로 검사한다.
function checkSocialConfig(config) {
  // SNS 미등록이 기본 인증 배포를 차단하지 않는다.
  return (
    assert.equal(config.vars.GOOGLE_CLIENT_ID, 'google-client'),
    assert.equal(config.vars.KAKAO_CLIENT_ID, 'kakao-client'),
    assert.equal(config.vars.NAVER_CLIENT_ID, 'naver-client'),
    assert.deepEqual(config.secrets.required, ['AUTH_SECRET']),
    assert.equal(
      JSON.stringify(config).includes('private-provider-secret'),
      false,
    )
  );
}

// 배포 결과에서 실제 서버 연결에 필요한 항목만 비교한다.
function projectConfig(config) {
  // 비밀 원문이 포함되면 vars 비교가 실패하도록 전체 공개 변수를 유지한다.
  return {
    name: config.name,
    vars: config.vars,
    database: config.d1_databases[0].binding,
    media: config.r2_buckets[0].binding,
    migrations: config.d1_databases[0].migrations_dir,
    secrets: config.secrets.required,
    env: config.env,
    keepVars: config.keep_vars,
  };
}

test('운영 저장소 미구성 배포는 차단한다', () => {
  // 스테이징 데이터베이스를 운영 앱에 잘못 연결하지 못하게 한다.
  return assert.ok(
    getReleaseIssues({ ...valid, RELEASE_ENV: 'production' }).some(
      (message) => {
        // 운영 저장소 미구성 오류의 존재만 확인한다.
        return message.includes('운영 D1·R2');
      },
    ),
  );
});

test('누락 설정과 fixture API 주소를 거부한다', () => {
  // 빈 설정 및 테스트 서버를 배포 준비 완료로 오인하지 않는다.
  return assert.deepEqual(
    [
      getReleaseIssues({}).length,
      getReleaseIssues({
        ...valid,
        EXPO_PUBLIC_API_URL: 'https://wherego-test.workers.dev',
      }).length > 0,
    ],
    [6, true],
  );
});

test('이전 Supabase 설정은 거부하며 오류에 키를 노출하지 않는다', () => {
  // 현재 앱에서 지원하지 않는 백엔드를 명시적으로 실패시킨다.
  return assert.deepEqual(
    getReleaseIssues({
      ...valid,
      EXPO_PUBLIC_BACKEND: 'supabase',
      EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijk.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_do_not_expose',
    }),
    ['EXPO_PUBLIC_BACKEND: 현재 앱은 cloudflare 필요'],
  );
});

test('복귀 도메인 불일치·로컬 API·URL 사용자 정보를 거부한다', () => {
  // 인증과 초대 주소가 실제 HTTPS 배포에 대응하는지 확인한다.
  return assert.deepEqual(
    [
      {
        ...valid,
        EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL:
          'https://other.pages.dev/auth/callback',
      },
      { ...valid, EXPO_PUBLIC_API_URL: 'http://localhost:8787' },
      {
        ...valid,
        EXPO_PUBLIC_API_URL: 'https://user:pass@travel-stage.workers.dev',
      },
    ].map((env) => {
      // 잘못된 공개 주소마다 배포 검사가 실패해야 한다.
      return getReleaseIssues(env).length > 0;
    }),
    [true, true, true],
  );
});
