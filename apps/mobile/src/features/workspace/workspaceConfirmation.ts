import type { WorkspaceSnapshot } from '@wherego/domain';
import type { WorkspaceCommand } from '@wherego/validation';
import { publicSelection } from '@wherego/validation';

// 삭제 확인은 선택한 원본 버전과 명령을 화면 수명 안에서만 보관한다.
export type WorkspaceConfirmation = {
  tripId: string;
  version: number;
  command: WorkspaceCommand;
  title: string;
  message: string;
  label: string;
};
type Details = Pick<WorkspaceConfirmation, 'title' | 'message' | 'label'>;

// 되돌리기 어려운 명령에만 대상과 영향 확인을 만든다.
export function workspaceConfirmation(
  snapshot: WorkspaceSnapshot,
  command: WorkspaceCommand,
): WorkspaceConfirmation | null {
  // 선택 당시 여행과 버전을 확인 문구와 함께 고정한다.
  return withConfirmation(
    snapshot,
    command,
    confirmationDetails(snapshot, command),
  );
}

// 일반 저장에는 확인 화면을 추가하지 않는다.
function withConfirmation(
  snapshot: WorkspaceSnapshot,
  command: WorkspaceCommand,
  details: Details | null,
): WorkspaceConfirmation | null {
  // 서버 명령 구조를 바꾸지 않고 화면 전용 확인 정보만 붙인다.
  return details
    ? {
        tripId: snapshot.trip.id,
        version: snapshot.trip.version,
        command,
        ...details,
      }
    : null;
}

// 명령별 실제 삭제·철회 정책을 사용자에게 설명한다.
function confirmationDetails(
  snapshot: WorkspaceSnapshot,
  command: WorkspaceCommand,
): Details | null {
  // 대상 ID로 찾은 이름만 사용하며 다른 항목을 대신 선택하지 않는다.
  switch (command.operation) {
    case 'community.publish':
      return publicationConfirmation(snapshot, command.input);
    case 'schedule.delete':
      return {
        title: '일정을 삭제할까요?',
        label: '일정 삭제하기',
        message: `‘${
          snapshot.itinerary.find((item) => {
            /* 선택한 일정의 제목만 읽는다. */ return (
              item.id === command.input.id
            );
          })?.title || '선택한 일정'
        }’을 삭제해요. 연결된 사진과 수동 비용은 남고, 이 일정에서 추가한 예상 비용은 삭제돼요. 영수증이 연결돼 있으면 삭제할 수 없어요.`,
      };
    case 'expense.delete':
      return expenseConfirmation(snapshot, command.input.id);
    case 'receipt.delete':
      return receiptConfirmation(snapshot, command.input.id);
    case 'media.delete':
      return {
        title: '사진을 삭제할까요?',
        label: '사진 삭제하기',
        message: `선택한 사진을 삭제해요. 확정한 영수증이 사용하는 사진은 삭제할 수 없어요.${snapshot.postId ? ' 이 여행의 커뮤니티 게시물도 함께 철회돼요.' : ''}`,
      };
    case 'member.remove':
      return {
        title: '동행 참여를 해제할까요?',
        label: '참여 해제하기',
        message: `‘${
          snapshot.members.find((item) => {
            /* 선택한 동행 이름을 고정한다. */ return (
              item.userId === command.input.userId
            );
          })?.nickname || '선택한 동행'
        }’이 이 여행의 기록을 보거나 수정할 수 없게 돼요. 이전에 수락한 초대도 취소돼요.`,
      };
    case 'invite.revoke':
      return {
        title: '초대를 취소할까요?',
        label: '초대 취소하기',
        message:
          '선택한 초대 링크로는 더 이상 이 여행에 참여할 수 없어요. 이미 참여한 동행의 권한은 그대로 유지돼요.',
      };
    case 'community.withdraw':
      return {
        title: '게시물을 철회할까요?',
        label: '게시 철회하기',
        message: `‘${snapshot.trip.title}’의 커뮤니티 게시물을 철회해요. 개인 여행 기록과 사진은 그대로 남아요.`,
      };
    default:
      return null;
  }
}

// 미리보기와 같은 선택 사본에서 공개 수와 기존 링크의 변경 범위를 만든다.
function publicationConfirmation(
  snapshot: WorkspaceSnapshot,
  input: Extract<WorkspaceCommand, { operation: 'community.publish' }>['input'],
  preview = publicSelection(snapshot, input),
): Details {
  // 원본 전체 개수가 아닌 이번에 선택한 항목만 공개 대상으로 안내한다.
  return {
    title: snapshot.postId
      ? '공개 내용을 바꿀까요?'
      : '선택한 내용을 공개할까요?',
    label: snapshot.postId ? '공개 내용 바꾸기' : '선택한 내용 공개',
    message: `링크를 가진 누구나 ‘${input.title}’의 선택 일정 ${preview.snapshot.itinerary.length}개·사진 ${preview.photoPaths.length}장${input.includeCosts ? '·통화별 실제 지출 합계' : ''}을 볼 수 있어요. 개인 메모·예약번호·동행 정보·영수증 원본과 품목은 공개하지 않아요.${snapshot.postId ? ' 기존 링크의 내용은 이번 선택으로 바뀌며 내 여행 원본은 그대로 남아요.' : ''}`,
  };
}

// 수동 비용의 제목과 금액을 확인 화면에 고정한다.
function expenseConfirmation(
  snapshot: WorkspaceSnapshot,
  id: string,
  expense = snapshot.expenses.find((item) => {
    // 선택한 비용을 찾는다.
    return item.id === id;
  }),
): Details {
  // 같은 ID의 비용만 찾아 삭제 대상을 표시한다.
  return {
    title: '비용을 삭제할까요?',
    label: '비용 삭제하기',
    message: `‘${expense?.title || '선택한 비용'}’ 비용${expense ? ` (${expense.amount} ${expense.currency})` : ''}을 삭제해요. 연결된 일정은 남아요. 영수증 비용은 영수증 기록에서 삭제해 주세요.`,
  };
}

// 영수증과 실제 지출의 동시 삭제 범위를 설명한다.
function receiptConfirmation(
  snapshot: WorkspaceSnapshot,
  id: string,
  receipt = snapshot.receipts.find((item) => {
    // 선택한 영수증을 찾는다.
    return item.id === id;
  }),
): Details {
  // 사진 보관 여부와 무관하게 같은 영수증을 확인한다.
  return {
    title: '영수증 기록을 삭제할까요?',
    label: '기록·지출 삭제하기',
    message: `‘${receipt?.merchant || '선택한 영수증'}’의 영수증 기록${receipt ? ` (${receipt.amount} ${receipt.currency})` : ''}과 실제 지출을 함께 삭제해요. 장소 일정과 보관한 사진은 남아요.`,
  };
}

// 확인 뒤 원본·권한·대상이 바뀌면 오래된 확인으로 실행하지 않는다.
export function canConfirmWorkspaceAction(
  confirmation: WorkspaceConfirmation,
  snapshot: WorkspaceSnapshot,
): boolean {
  // 실제 서버에서도 버전과 권한을 다시 검사한다.
  return (
    confirmation.tripId === snapshot.trip.id &&
    confirmation.version === snapshot.trip.version &&
    snapshot.myRole !== 'viewer' &&
    snapshot.trip.status !== 'ARCHIVED' &&
    confirmationTargetExists(confirmation.command, snapshot)
  );
}

// 명령이 가리키는 원본과 관리 권한을 현재 스냅샷에서 확인한다.
function confirmationTargetExists(
  command: WorkspaceCommand,
  snapshot: WorkspaceSnapshot,
): boolean {
  // 삭제된 항목의 ID를 다른 항목에 재사용하지 않는다.
  switch (command.operation) {
    case 'community.publish':
      return (
        snapshot.myRole === 'owner' &&
        (command.input.kind === 'plan'
          ? command.input.scheduleIds.length > 0
          : snapshot.trip.status === 'COMPLETED') &&
        command.input.scheduleIds.every((id) => {
          // 확인 사이 삭제되거나 다른 여행에서 온 일정은 허용하지 않는다.
          return snapshot.itinerary.some((item) => {
            // 선택 ID가 같은 여행의 실제 일정인지 검사한다.
            return item.id === id;
          });
        }) &&
        command.input.photoIds.every((id) => {
          // 영수증 원본은 공개 사진으로 확인하지 않는다.
          return snapshot.media.some((item) => {
            // 기존에 등록한 일반 사진만 허용한다.
            return item.id === id && item.purpose === 'photo';
          });
        })
      );
    case 'schedule.delete':
      return snapshot.itinerary.some((item) => {
        /* 같은 일정 ID만 허용한다. */ return item.id === command.input.id;
      });
    case 'expense.delete':
      return snapshot.expenses.some((item) => {
        /* 같은 비용 ID만 허용한다. */ return item.id === command.input.id;
      });
    case 'receipt.delete':
      return snapshot.receipts.some((item) => {
        /* 같은 영수증 ID만 허용한다. */ return item.id === command.input.id;
      });
    case 'media.delete':
      return snapshot.media.some((item) => {
        /* 같은 사진 ID만 허용한다. */ return item.id === command.input.id;
      });
    case 'member.remove':
      return (
        snapshot.myRole === 'owner' &&
        snapshot.members.some((item) => {
          /* 소유자 제거는 허용하지 않는다. */ return (
            item.userId === command.input.userId && item.role !== 'owner'
          );
        })
      );
    case 'invite.revoke':
      return (
        snapshot.myRole === 'owner' &&
        snapshot.invites.some((item) => {
          /* 이미 취소된 초대를 다시 실행하지 않는다. */ return (
            item.id === command.input.id && !item.revokedAt
          );
        })
      );
    case 'community.withdraw':
      return snapshot.myRole === 'owner' && Boolean(snapshot.postId);
    default:
      return false;
  }
}
