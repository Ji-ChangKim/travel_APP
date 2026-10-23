import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { repositoryPath } from '../shared/repository-paths.cjs';

// 동시에 진행하는 검수는 서로의 산출물과 서버 주소를 덮어쓰지 않는다.
const previewName = process.env.TRIPPRINT_PREVIEW_NAME || 'schedule-ui-web';
const previewPort = Number(process.env.TRIPPRINT_PREVIEW_PORT || 8788);
if (
  !/^[a-z][a-z0-9-]{0,63}$/.test(previewName) ||
  !Number.isInteger(previewPort) ||
  previewPort < 1024 ||
  previewPort > 65535
)
  throw new Error('검수 폴더 이름과 포트를 확인해 주세요.');
const previewUrl = `http://127.0.0.1:${previewPort}`;

// 배포 번들의 캐시와 섞이지 않는 로컬 검수 환경을 만든다.
function buildPreview() {
  // 셸에 키를 연결하지 않고 고정된 공개 검사 값으로만 내보낸다.
  return new Promise((resolve, reject) => {
    // 환경 값을 바꿔도 남을 수 있는 Metro 변환 캐시를 반드시 비운다.
    const child = spawn(
      process.execPath,
      [
        repositoryPath('node_modules/expo/bin/cli'),
        'export',
        '--platform',
        'web',
        '--clear',
        '--output-dir',
        `.release/${previewName}`,
      ],
      {
        cwd: repositoryPath('apps/mobile'),
        stdio: 'inherit',
        env: {
          ...process.env,
          EXPO_NO_DOTENV: '1',
          EXPO_PUBLIC_BACKEND: 'cloudflare',
          EXPO_PUBLIC_API_URL: previewUrl,
          EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL: `${previewUrl}/auth/callback`,
          EXPO_PUBLIC_SUPABASE_URL: 'https://wherego-test.supabase.co',
          EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
        },
      },
    );
    child.once('error', reject);
    child.once('exit', (code) => {
      // 실패한 export로 브라우저 검수를 시작하지 않는다.
      return code === 0
        ? resolve()
        : reject(new Error(`검수 번들 생성 실패: ${code}`));
    });
  });
}

// 실제 JavaScript에 들어간 주소를 검사해 환경 캐시 오염을 차단한다.
function verifyPreview() {
  // 시험용 HTML 메타데이터가 아닌 앱 실행 청크를 확인한다.
  return readdirSync(
    repositoryPath('apps/mobile/.release', previewName, '_expo/static/js/web'),
  )
    .filter((file) => {
      // 앱 진입 청크만 확인한다.
      return /^entry-.*\.js$/.test(file);
    })
    .every((file) => {
      // staging 주소가 남아 있으면 검수를 실패로 처리한다.
      const source = readFileSync(
        repositoryPath(
          'apps/mobile/.release',
          previewName,
          '_expo/static/js/web',
          file,
        ),
        'utf8',
      );
      return (
        source.includes(previewUrl) &&
        !source.includes('tripprint-api-staging.gametps.workers.dev')
      );
    });
}

await buildPreview();
if (!verifyPreview())
  throw new Error('검수 번들의 API 주소가 로컬 환경과 다릅니다.');
console.info('로컬 검수 API 주소와 staging 주소 미포함 확인 완료');
