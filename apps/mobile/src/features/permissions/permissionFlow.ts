import {
  permissionAction,
  type PermissionKind,
  type PermissionSnapshot,
  type PermissionStatus,
} from './permissionModel';

type PermissionPort = {
  read: () => Promise<PermissionSnapshot>;
  request: (kind: PermissionKind) => Promise<PermissionStatus>;
  settings: () => Promise<unknown>;
};

// 요청 직전에 실제 상태를 읽고 해당 권한의 다음 동작만 실행한다.
export async function resolvePermission(
  kind: PermissionKind,
  port: PermissionPort,
  active: () => boolean,
): Promise<PermissionSnapshot | undefined> {
  // 조회가 끝나기 전에 화면을 떠나면 운영체제 요청을 실행하지 않는다.
  const current = await port.read();
  return !active()
    ? undefined
    : permissionAction(current[kind]) === 'settings'
      ? port.settings().then(() => {
          // 설정에서 돌아온 상태는 별도 전경 조회로 갱신한다.
          return active() ? current : undefined;
        })
      : permissionAction(current[kind]) === 'request'
        ? port.request(kind).then((result) => {
            // 다른 권한은 유지하고 선택한 권한의 실제 결과만 반영한다.
            return active() ? { ...current, [kind]: result } : undefined;
          })
        : current;
}
