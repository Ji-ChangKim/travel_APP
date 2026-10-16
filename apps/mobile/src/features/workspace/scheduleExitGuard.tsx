import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useIsFocused, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { create } from 'zustand';
import { ScheduleButton } from './ScheduleControls';
import { scheduleStyles as s } from './scheduleTheme';

// 모든 작성 폼은 화면 전용 값만 비교하며 서버 계약을 변경하지 않는다.
type EditableForm = {
  kind: string;
  id: string;
  values: Record<string, unknown>;
};
type Guard = {
  owner: string | null;
  title: string;
  blocked: boolean;
  busy: boolean;
  pending: (() => void) | null;
  commit: boolean;
  discard: (() => void) | null;
};
const guard = create<Guard>(() => {
  // 작성 내용이나 계정 자료는 전역에 저장하지 않고 이탈 상태만 공유한다.
  return {
    owner: null,
    title: '작성 중인 내용을 버릴까요?',
    blocked: false,
    busy: false,
    pending: null,
    commit: false,
    discard: null,
  };
});

// 저장·삭제 확인·결과 확인 중에는 이동하지 않고 변경한 폼은 명시적 확인을 거친다.
export function requestScheduleExit(action: () => void): void {
  // 이미 확인 중인 이동 대상을 연속 탭으로 교체하지 않는다.
  return guard.getState().busy || guard.getState().pending
    ? undefined
    : guard.getState().blocked
      ? guard.setState({ pending: action, commit: false })
      : action();
}

// 저장 성공을 확인한 화면만 보호 해제 렌더 뒤 다음 경로로 이동한다.
export function completeFormExit(action: () => void): void {
  // 사용자 버리기와 달리 저장된 폼의 이동에는 추가 확인을 요구하지 않는다.
  return guard.setState({
    blocked: false,
    busy: false,
    discard: null,
    pending: action,
    commit: true,
  });
}

// 자신이 등록한 보호 상태만 해제해 뒤에 열린 화면의 보호를 지우지 않는다.
function releaseGuard(owner: string): void {
  // 숨겨진 탭의 늦은 정리도 현재 화면에는 영향을 주지 않는다.
  return guard.getState().owner === owner
    ? guard.setState({
        owner: null,
        blocked: false,
        busy: false,
        pending: null,
        commit: false,
        discard: null,
      })
    : undefined;
}

// 현재 폼의 변경 여부를 닫기·전역 이동·뒤로가기에 함께 적용한다.
export function useScheduleExitGuard(
  form: EditableForm | null,
  busy: boolean,
  close: (form: null) => void,
): void {
  // 계정별로 다시 마운트된 화면은 이전 화면의 기준값을 재사용하지 않는다.
  const owner = useId();
  const focused = useIsFocused();
  const baseline = useRef({ id: '', values: '' });
  const id = form ? `${form.kind}:${form.id}` : '';
  const values = form ? JSON.stringify(form.values) : '';
  const kind = form?.kind;
  const navigation = useNavigation();
  const blocked = guard((state) => {
    // 다른 탭이나 화면의 보호 상태로 이 화면의 뒤로를 막지 않는다.
    return state.owner === owner && state.blocked;
  });
  usePreventRemove(focused && (blocked || busy), ({ data }) => {
    // 시스템 뒤로가기도 같은 확인 절차를 사용한다.
    return requestScheduleExit(() => {
      // 사용자가 확인한 원래 이동 요청만 재실행한다.
      return navigation.dispatch(data.action);
    });
  });
  useLayoutEffect(() => {
    // 사용자 입력 다음 프레임에 이탈 버튼을 누르기 전 보호를 갱신한다.
    return !focused
      ? releaseGuard(owner)
      : (baseline.current.id !== id
          ? (baseline.current = { id, values })
          : undefined,
        guard.setState((state) => {
          // 같은 화면의 확인된 이동은 유지하고 다른 화면의 대기 이동은 폐기한다.
          return {
            ...(state.owner === owner ? {} : { pending: null, commit: false }),
            owner,
            title:
              kind === 'schedule'
                ? '작성 중인 일정을 버릴까요?'
                : '작성 중인 내용을 버릴까요?',
            blocked: Boolean(id && baseline.current.values !== values),
            busy,
            discard: id
              ? () => {
                  // 명시적으로 버린 폼만 닫고 원본·저장 요청은 삭제하지 않는다.
                  return close(null);
                }
              : null,
          };
        }));
  }, [owner, focused, id, kind, busy, values, close]);
  useEffect(() => {
    // 같은 계정으로 돌아와도 해제된 화면의 대기 이동은 실행하지 않는다.
    return () => releaseGuard(owner);
  }, [owner]);
  useEffect(() => {
    // 웹 새로고침·탭 닫기는 브라우저 기본 경고를 사용한다.
    return Platform.OS === 'web' && focused && (blocked || busy)
      ? connectUnload()
      : undefined;
  }, [focused, blocked, busy]);
}

// 브라우저를 떠날 때만 기본 경고를 연결한다.
function connectUnload(): () => void {
  // 브라우저별 문구는 앱에서 임의로 대체하지 않는다.
  const handler = (event: BeforeUnloadEvent) => {
    // 기본 확인창이 열리도록 변경 내용을 표시한다.
    return (event.preventDefault(), (event.returnValue = ''));
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}

// 전역 메뉴보다 위에서 계속 작성과 버리기를 선택하게 한다.
export default function ScheduleExitDialog() {
  // 작성 화면은 그대로 유지해 취소 후 입력을 복원할 필요가 없게 한다.
  const state = guard();
  const { commit, pending } = state;
  useEffect(() => {
    // 차단 해제를 렌더링한 다음 확인한 행동 하나만 수행한다.
    return commit &&
      pending &&
      guard.getState().pending === pending &&
      guard.getState().commit
      ? (guard.setState({ pending: null, commit: false }), pending())
      : undefined;
  }, [commit, pending]);
  return (
    <ActionSheet
      title={state.title}
      priority={100}
      visible={Boolean(state.pending && !state.commit)}
      onClose={() => {
        // 확인창만 닫고 원래 작성 내용은 유지한다.
        guard.setState({ pending: null });
      }}
    >
      <Text style={s.body}>
        아직 저장하지 않은 내용이 있어요. 계속 작성하거나 내용을 버리고 이동할
        수 있어요.
      </Text>
      <ScheduleButton
        label="계속 작성"
        primary
        onPress={() => {
          // 기존 입력과 선택한 삽입 순서를 그대로 유지한다.
          return guard.setState({ pending: null });
        }}
      />
      <ScheduleButton
        label="내용 버리고 이동"
        onPress={() => {
          // 명시적으로 버린 경우에만 요청한 화면으로 이동한다.
          return (
            state.discard?.(),
            guard.setState({ blocked: false, commit: true })
          );
        }}
      />
    </ActionSheet>
  );
}
