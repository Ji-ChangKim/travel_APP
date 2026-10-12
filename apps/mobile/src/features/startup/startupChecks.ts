import { startupManifestSchema, type StartupManifest } from '@wherego/validation';
import { apiBaseUrl } from '@/features/workspace/service';
import { loadStoredGuestSession } from '@/services/guestAuthService';
import { readGuestWorkspace } from '@/services/guestWorkspaceStorage';
import { checkPlayUpdate } from './playUpdate';
import { readStartupManifest, saveStartupManifest } from './startupStorage';

export type StartupChecks = {
  commonData: 'current' | 'changed' | 'cached' | 'unavailable';
  localData: 'valid' | 'absent';
  play: Awaited<ReturnType<typeof checkPlayUpdate>>;
};

// 기기에 남은 여행은 비활성 게스트까지 읽되 원본을 수정하지 않는다.
export function checkLocalData(): Promise<'valid' | 'absent'> {
  // 알 수 없는 형식을 빈 여행으로 바꾸거나 덮어쓰지 않는다.
  return loadStoredGuestSession(false).then((profile) => {
    // 저장 문서의 소유자와 실제 게스트 UUID를 대조한다.
    return profile ? readGuestWorkspace(profile.id).then((document) => {
      // readGuestWorkspace의 엄격한 version=1 검증을 통과한 문서만 연다.
      return document.ownerId === profile.id ? 'valid' as const : Promise.reject(new Error('이 기기의 여행 기록을 열지 못했어요. 앱을 업데이트한 뒤 다시 시도해 주세요.'));
    }) : 'absent' as const;
  }).catch(() => {
    // 저장된 여행은 그대로 보존하고 재시도 방법을 안내한다.
    return Promise.reject(new Error('이 기기의 여행 기록을 열지 못했어요. 앱을 업데이트한 뒤 다시 시도해 주세요.'));
  });
}

// 로그인 정보 없이 서버 공통 여행 데이터 버전을 확인한다.
function fetchManifest(): Promise<StartupManifest> {
  // 외부 데이터 전체 다운로드 대신 작은 버전 응답만 기다린다.
  return fetch(`${apiBaseUrl().replace(/\/$/, '')}/public/startup`, { signal: AbortSignal.timeout(8000) }).then((response) => {
    // HTTP 실패를 정상 버전 응답으로 바꾸지 않는다.
    return response.ok ? response.json().then((body: unknown) => {
      // 잘못된 배포 응답도 최신 버전으로 기록하지 않는다.
      return startupManifestSchema.parse(body && typeof body === 'object' && 'data' in body ? body.data : null);
    }) : Promise.reject(new Error('여행을 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'));
  });
}

// 현재 앱이 실제로 읽을 수 있는 버전만 승인한다.
function supportedManifest(manifest: StartupManifest): StartupManifest {
  // 서버 계약이 더 새로우면 사용자 기록을 수정하지 않고 업데이트를 요청한다.
  return manifest.protocolVersion === 1 && manifest.guestDataVersion === 1 ? manifest : (() => {
    // 호환되지 않는 형식으로 앱을 진행하지 않는다.
    throw new Error('새로운 여행을 이어가려면 앱을 업데이트해 주세요.');
  })();
}

// 네트워크 실패 시 이전에 확인한 공통 정보 또는 기기 여행을 이용한다.
function offlineManifest(previous: StartupManifest | null, local: 'valid' | 'absent'): StartupChecks['commonData'] {
  // 기록이 없는 최초 실행은 재시도를 통해 필요한 정보를 먼저 확인한다.
  return previous ? (supportedManifest(previous), 'cached') : local === 'valid' ? 'unavailable' : (() => {
    // 연결 실패를 공통 데이터 최신 확인으로 처리하지 않는다.
    throw new Error('여행을 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
  })();
}

// 성공한 새 버전과 이전 메모를 비교한다.
function acceptManifest(manifest: StartupManifest, previous: StartupManifest | null): Promise<StartupChecks['commonData']> {
  // 저장소가 차단되어도 실제 온라인 조회 결과는 사용할 수 있다.
  return saveStartupManifest(supportedManifest(manifest)).catch(() => {
    // 다음 시작에서 다시 확인하며 여행 저장소는 건드리지 않는다.
    return undefined;
  }).then(() => {
    // 변경된 공통 캐시만 호출 계층에서 비운다.
    return previous?.commonDataVersion === manifest.commonDataVersion ? 'current' : 'changed';
  });
}

// 조회 실패와 호환성 실패를 서로 다른 경로로 처리한다.
function checkCommonData(local: 'valid' | 'absent'): Promise<StartupChecks['commonData']> {
  // 실제 서버 성공 응답의 호환성 오류를 캐시로 우회하지 않는다.
  return readStartupManifest().then((previous) => {
    // 네트워크 응답 거절만 오프라인 경로로 보낸다.
    return fetchManifest().then((manifest) => {
      // 호환성 검증은 실패 복구의 바깥에서 실행한다.
      return acceptManifest(manifest, previous);
    }, () => {
      // 마지막으로 확인한 버전과 기기 여행 여부를 구분한다.
      return offlineManifest(previous, local);
    });
  });
}

// 연출과 동시에 데이터·스토어 확인을 시작한다.
export function checkStartup(): Promise<StartupChecks> {
  // 개인 인증 확인은 AuthBridge에서 병렬 실행한다.
  return Promise.all([checkLocalData(), checkPlayUpdate()]).then(([localData, play]) => {
    // 기기 원본 검증 실패는 다음 화면 진입을 막는다.
    return checkCommonData(localData).then((commonData) => {
      // 각 검사의 실제 결과를 보존한다.
      return { localData, commonData, play };
    });
  });
}
