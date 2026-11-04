import { t } from '@/features/localization/translate';
import { clearCreationHandoff } from '../../creationAuthHandoff';
import { useLocale } from '@/features/localization/localeState';
import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useIsFocused, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { create } from 'zustand';
import { ScheduleButton } from './ScheduleControls';
import { scheduleStyles as s } from '../styles/scheduleTheme';
import { connectBrowserHistoryGuard } from '../../browserHistoryEvents';

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

// 로그인 복귀용 입력을 보관한 경우에만 버리기 확인 없이 이동한다.
export function continueFormAfterPreserving(action: () => void): void {
  if (guard.getState().busy || guard.getState().pending) return;
  guard.setState({
    blocked: false,
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
  const baseline = useRef({ id: '', values: '', revision: '' });
  const id = form ? `${form.kind}:${form.id}` : '';
  const values = form ? JSON.stringify(form.values) : '';
  const revision =
    form?.kind === 'trip' ? String(form.values._draftRevision || '') : '';
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
      : (baseline.current.id !== id || baseline.current.revision !== revision
          ? (baseline.current = { id, values, revision })
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
            blocked: Boolean(
              id &&
              (baseline.current.values !== values ||
                form?.values._authUnsaved === 'true'),
            ),
            busy,
            discard: id
              ? () => {
                  // 명시적으로 버린 폼만 닫고 원본·저장 요청은 삭제하지 않는다.
                  if (form?.kind === 'trip') clearCreationHandoff(form.id);
                  return close(null);
                }
              : null,
          };
        }));
  }, [owner, focused, id, kind, busy, values, close, form, revision]);
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

// 기록을 추가·덮어쓰지 않고 원래 항목으로 복귀한 뒤 기존 이탈 확인을 사용한다.
function connectHistoryGuard(): (() => void) | undefined {
  const browserNavigation = window.navigation;
  if (!browserNavigation) return undefined;
  let from: NavigationHistoryEntry | null = null;
  let restoring = false;
  let restoreKey: string | null = null;
  let restoredKey: string | null = null;
  let restoreOwner: string | null = null;
  let replayDelta = 0;
  let confirmExit = false;
  const onNavigate = (event: NavigateEvent) => {
    if (restoring) {
      event.stopImmediatePropagation();
      return;
    }
    const state = guard.getState();
    if (!restoring && event.navigationType === 'traverse') restoredKey = null;
    if (
      !restoring &&
      event.navigationType === 'traverse' &&
      event.destination.sameDocument &&
      state.owner !== null &&
      !state.commit &&
      (state.busy || state.blocked || state.pending)
    ) {
      from = browserNavigation.currentEntry;
      restoreOwner = state.owner;
      // 저장 중 눌렀던 뒤로 이동을 저장 완료 직후에 뒤늦게 실행하지 않는다.
      confirmExit = !state.busy && !state.pending;
      event.stopImmediatePropagation();
    }
  };
  const handleRestore = (): boolean => {
    if (restoring) {
      // 원래 뒤로가기의 popstate를 복원 완료로 오인하면 왕복 이동이 다시 차단된다.
      if (browserNavigation.currentEntry?.key !== restoreKey) return true;
      restoring = false;
      restoredKey = restoreKey;
      restoreKey = null;
      // 계정이나 작성 화면이 바뀌면 이전 화면의 이동 확인을 새 작성자에게 넘기지 않는다.
      if (confirmExit && guard.getState().owner === restoreOwner) {
        const confirmedDelta = replayDelta;
        const confirmedOwner = restoreOwner;
        requestScheduleExit(() => {
          if (guard.getState().owner === confirmedOwner)
            window.history.go(confirmedDelta);
        });
      }
      return true;
    }
    const current = browserNavigation.currentEntry;
    if (!from || !current) return false;
    const targetKey = from.key;
    const delta = from.index - current.index;
    from = null;
    if (!delta) return false;
    // Router가 쿼리 변경으로 폼을 교체하기 전에 이동을 되돌린다.
    replayDelta = -delta;
    restoring = true;
    restoreKey = targetKey;
    window.history.go(delta);
    return true;
  };
  const onPopState = (event: PopStateEvent) => {
    if (
      handleRestore() ||
      (restoredKey !== null &&
        browserNavigation.currentEntry?.key === restoredKey)
    ) {
      // 복원된 URL에 이전 항목의 상태를 전달하면 새 작성 폼이 다시 마운트된다.
      event.stopImmediatePropagation();
    }
  };
  const onEntryChange = (event: Event) => {
    if (handleRestore()) event.stopImmediatePropagation();
  };
  browserNavigation.addEventListener('navigate', onNavigate, true);
  browserNavigation.addEventListener('currententrychange', onEntryChange, true);
  const disconnectPopState = connectBrowserHistoryGuard(onPopState);
  return () => {
    browserNavigation.removeEventListener('navigate', onNavigate, true);
    browserNavigation.removeEventListener(
      'currententrychange',
      onEntryChange,
      true,
    );
    disconnectPopState();
  };
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
  useLocale();
  useLayoutEffect(() => {
    // 화면 전환 중에도 같은 감시를 유지하며 진입점의 선행 구독에 검사기를 연결한다.
    return Platform.OS === 'web' ? connectHistoryGuard() : undefined;
  }, []);
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
      variant="confirm"
      title={state.title}
      priority={100}
      visible={Boolean(state.pending && !state.commit)}
      onClose={() => {
        // 확인창만 닫고 원래 작성 내용은 유지한다.
        guard.setState({ pending: null });
      }}
    >
      <Text style={s.body}>
        {t(
          '아직 저장하지 않은 내용이 있어요. 계속 작성하거나 내용을 버리고 이동할 수 있어요.',
        )}
      </Text>
      <ScheduleButton
        label={t('계속 작성')}
        primary
        onPress={() => {
          // 기존 입력과 선택한 삽입 순서를 그대로 유지한다.
          return guard.setState({ pending: null });
        }}
      />
      <ScheduleButton
        label={t('내용 버리고 이동')}
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
