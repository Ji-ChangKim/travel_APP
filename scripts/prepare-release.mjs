import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getReleaseIssues } from './release-config.mjs';

// 고정된 Node 실행 파일과 인수로 로컬 준비 명령만 실행한다.
function run(args, cwd) {
  // 셸 문자열에 키나 사용자 입력을 연결하지 않는다.
  return new Promise((resolve, reject) => {
    // Expo의 로컬 .env 로딩을 꺼 릴리스 환경만 사용한다.
    const child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, EXPO_NO_DOTENV: '1' },
      stdio: 'inherit',
    });
    // 실행 실패 시 후속 단계를 진행하지 않는다.
    child.once('error', reject);
    // 실패한 빌드를 배포용 성공 결과로 취급하지 않는다.
    child.once('exit', (code) => {
      // 성공 종료만 다음 단계로 전달한다.
      return code === 0
        ? resolve()
        : reject(new Error(`준비 명령 종료 코드 ${code}`));
    });
  });
}

// 검증된 공개 설정으로 웹 export와 Worker dry-run을 준비한다.
async function prepare() {
  // 설정이 없으면 파일 생성이나 빌드를 시작하지 않는다.
  if (getReleaseIssues(process.env).length)
    throw new Error(getReleaseIssues(process.env).join('\n'));
  // 같은 설정으로 API 환경 파일을 만든다.
  await run([
    fileURLToPath(new URL('./release-config.mjs', import.meta.url)),
    '--write-worker',
  ]);
  // Metro 캐시와 개발 .env가 섞이지 않는 웹 번들을 만든다.
  await run(
    [
      fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url)),
      'export',
      '--platform',
      'web',
      '--clear',
    ],
    fileURLToPath(new URL('../apps/mobile/', import.meta.url)),
  );
  // 웹 진입 경로와 테스트 키 미포함을 확인한다.
  await run([
    fileURLToPath(new URL('./release-artifacts.mjs', import.meta.url)),
  ]);
  // 실제 업로드 대신 생성된 설정의 Worker를 빌드한다.
  await run(
    [
      fileURLToPath(
        new URL(
          '../apps/api/node_modules/wrangler/bin/wrangler.js',
          import.meta.url,
        ),
      ),
      'deploy',
      '--config',
      '.release/wrangler.json',
      '--dry-run',
    ],
    fileURLToPath(new URL('../apps/api/', import.meta.url)),
  );
}

// 모든 실패는 비정상 종료로 알려 배포 준비 완료 오판을 막는다.
prepare().catch((error) => {
  // 비밀 값 대신 검증 오류만 표시한다.
  console.error(error.message);
  // 다음 배포 작업을 자동 진행하지 못하게 한다.
  process.exitCode = 1;
});
