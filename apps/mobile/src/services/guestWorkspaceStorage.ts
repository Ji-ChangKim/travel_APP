import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import {
  guestWorkspaceSchema,
  emptyGuestWorkspace,
  type GuestWorkspace,
} from './guestWorkspaceModel';

// 게스트 UUID마다 서로 다른 영구 문서 파일을 사용한다.
function documentFile(userId: string): File {
  // 캐시 삭제와 다른 계정의 기록 조회를 피한다.
  return new File(Paths.document, `tripprint-guest-${userId}.json`);
}

// 웹과 네이티브의 영구 기기 저장소에서 읽는다.
export function readGuestWorkspace(userId: string): Promise<GuestWorkspace> {
  // 잘못된 문서는 빈 기록으로 바꾸어 덮어쓰지 않는다.
  return (
    Platform.OS === 'web'
      ? Promise.resolve(
          typeof localStorage === 'undefined'
            ? null
            : localStorage.getItem(`tripprint-guest-${userId}`),
        )
      : documentFile(userId).exists
        ? documentFile(userId).text()
        : Promise.resolve(null)
  ).then((text) => {
    // 문서와 현재 게스트 UUID 일치는 처리 계층에서 다시 확인한다.
    return text
      ? guestWorkspaceSchema.parse(JSON.parse(text))
      : emptyGuestWorkspace(userId);
  });
}

// 전체 여행·요청 결과를 하나의 영구 문서로 저장한다.
export function writeGuestWorkspace(document: GuestWorkspace): Promise<void> {
  // 용량 부족 등 실제 저장 실패를 성공으로 처리하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve().then(() => {
        // localStorage의 한 키 교체는 중간 JSON을 노출하지 않는다.
        return localStorage.setItem(
          `tripprint-guest-${document.ownerId}`,
          JSON.stringify(guestWorkspaceSchema.parse(document)),
        );
      })
    : writeDocument(documentFile(document.ownerId), document);
}

// 기기 문서를 완전히 쓴 후 기존 파일 위치로 교체한다.
function writeDocument(
  target: File,
  document: GuestWorkspace,
  temporary = new File(
    Paths.document,
    `tripprint-guest-${document.ownerId}.pending.json`,
  ),
): Promise<void> {
  // 기존 성공 문서는 새 JSON의 쓰기 완료 전까지 유지한다.
  return Promise.resolve(
    temporary.write(JSON.stringify(guestWorkspaceSchema.parse(document))),
  ).then(() => {
    // 같은 게스트의 쓰기는 상위 큐에서 직렬화한다.
    return temporary.move(target, { overwrite: true });
  });
}

// 네이티브 사진 파일은 기기 문서 디렉터리 안에서만 연다.
export function guestFileUri(uri: string): string {
  // 앱 업데이트로 문서 경로가 바뀌어도 파일명을 기준으로 복원한다.
  return Platform.OS === 'web'
    ? uri
    : new File(Paths.document, uri.split('/').at(-1) || '').uri;
}

// 기기에 더 이상 참조하지 않는 이 기능의 원본만 지운다.
export function cleanGuestFiles(
  before: GuestWorkspace,
  after: GuestWorkspace,
): Promise<void> {
  // 문서 저장 실패 전에는 어떤 원본도 지우지 않는다.
  return Promise.all(
    Object.entries(before.files)
      .filter(([path]) => {
        // 보관 선택한 사진과 미확정 업로드는 계속 유지한다.
        return !after.files[path];
      })
      .map(([, value]) => {
        // 웹 원본은 문서 안의 data URI이므로 별도 파일이 없다.
        return Platform.OS === 'web'
          ? undefined
          : deleteGuestFile(new File(guestFileUri(value.uri)));
      }),
  ).then(() => {
    // 실제 원본 정리 실패도 재시도 대상으로 전달한다.
    return undefined;
  });
}

// 이미 제거한 원본에 대한 재시도는 성공으로 처리한다.
function deleteGuestFile(file: File): void {
  // 이 기능이 만든 로컬 파일만 상위 정리 목록에 들어온다.
  return file.exists ? file.delete() : undefined;
}
