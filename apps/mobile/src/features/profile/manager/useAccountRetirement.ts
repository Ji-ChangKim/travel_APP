import { submitOnce } from '@/features/forms/submissionLock';
import { serverOptions } from '@/features/workspace/shared/manager/service';
import {
  completeFormExit,
  useScheduleExitGuard,
} from '@/features/workspace/schedule/ui/scheduleExitGuard';
import { authRevision, clearRevokedCloudSession } from '@/services/cloudAuth';
import { useTripStore } from '@/stores/useTripStore';
import { t } from '@/features/localization/translate';
import { foundationQueryKey } from '@wherego/api-client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  accountRequestFailure,
  type AccountConfirmation,
} from '../model/accountManagement';
import {
  loadAccountManagement,
  submitAccountDeletion,
  submitOwnershipTransfer,
} from './accountManagementService';

type AccountActionState = {
  actorId: string;
  revision: number;
  busy: boolean;
  error: string;
  notice: string;
  reauthenticate: boolean;
  needsRefresh: boolean;
  selection: Record<string, string>;
  confirmation: AccountConfirmation | null;
};
function emptyAction(actorId: string, revision: number): AccountActionState {
  return {
    actorId,
    revision,
    busy: false,
    error: '',
    notice: '',
    reauthenticate: false,
    needsRefresh: false,
    selection: {},
    confirmation: null,
  };
}

// 조회 캐시와 변경 요청 모두 계정·인증 수명으로 구분한다.
export function useAccountRetirement() {
  const user = useTripStore((state) => state.currentUser);
  const userId = user?.id || '';
  const member = Boolean(userId && user?.authProvider !== 'guest');
  const revision = authRevision();
  const router = useRouter();
  const lock = useRef(false);
  const scope = useRef({ active: true });
  const [action, setAction] = useState(() => emptyAction(userId, revision));
  const [acceptedRevision, setAcceptedRevision] = useState<number | null>(null);
  const state =
    action.actorId === userId && action.revision === revision
      ? action
      : emptyAction(userId, revision);
  const query = useQuery({
    queryKey: foundationQueryKey(userId, 'account-management'),
    queryFn: async ({ signal }) =>
      loadAccountManagement(await serverOptions(userId), userId, signal),
    enabled: member,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const management =
    !state.needsRefresh && query.data?.account.id === userId
      ? query.data
      : null;
  const loading = member && (query.isPending || query.isFetching);
  const recovery = query.isError ? accountRequestFailure(query.error) : null;
  const completed = acceptedRevision !== null && acceptedRevision === revision;
  const confirming = state.confirmation;
  const busy = state.busy;

  useEffect(() => {
    const current = scope.current;
    current.active = true;
    return () => {
      current.active = false;
    };
  }, []);
  useScheduleExitGuard(null, busy, () => {});

  function valid(actorId: string, started: number): boolean {
    return (
      scope.current.active &&
      authRevision() === started &&
      useTripStore.getState().currentUser?.id === actorId
    );
  }
  function patch(change: Partial<AccountActionState>): void {
    setAction((previous) => ({
      ...(previous.actorId === userId && previous.revision === revision
        ? previous
        : emptyAction(userId, revision)),
      ...change,
    }));
  }
  function reload(): void {
    if (busy || lock.current || !member) return;
    patch({
      error: '',
      reauthenticate: false,
      needsRefresh: true,
      confirmation: null,
      selection: {},
    });
    void query.refetch().then((result) => {
      if (valid(userId, revision) && result.isSuccess)
        patch({ needsRefresh: false });
    });
  }
  function chooseOwner(tripId: string, newOwnerId: string): void {
    if (
      busy ||
      loading ||
      !management?.transfers.some(
        (trip) =>
          trip.id === tripId &&
          trip.candidates.some((candidate) => candidate.id === newOwnerId),
      )
    )
      return;
    patch({
      selection: { ...state.selection, [tripId]: newOwnerId },
      confirmation: null,
    });
  }
  function confirmTransfer(tripId: string): void {
    const trip = management?.transfers.find((value) => value.id === tripId);
    const candidate = trip?.candidates.find(
      (value) => value.id === state.selection[tripId],
    );
    if (!trip || !candidate || busy || loading) return;
    patch({
      confirmation: {
        kind: 'transfer',
        actorId: userId,
        tripId,
        tripTitle: trip.title,
        newOwnerId: candidate.id,
        name: t('{name} · 동행자 {number}', {
          name: candidate.name,
          number:
            trip.candidates.findIndex((value) => value.id === candidate.id) + 1,
        }),
        version: trip.version,
      },
    });
  }
  function confirmDeletion(): void {
    if (
      !management ||
      busy ||
      loading ||
      management.preview.ownershipTransfersRequired.length
    )
      return;
    patch({
      confirmation: {
        kind: 'delete',
        actorId: userId,
        policyVersion: management.preview.policyVersion,
      },
    });
  }
  function cancelConfirmation(): void {
    if (!busy && !lock.current) patch({ confirmation: null });
  }
  function confirmRequest(): void {
    if (!confirming || !management || busy || loading || lock.current) return;
    const submitted = confirming;
    const started = revision;
    patch({ busy: true, error: '', notice: '', reauthenticate: false });
    submitOnce(lock, async () => {
      const options = await serverOptions(submitted.actorId);
      if (!options.accessToken || !valid(submitted.actorId, started)) return;
      if (submitted.kind === 'transfer') {
        await submitOwnershipTransfer(options, submitted);
        if (!valid(submitted.actorId, started)) return;
        patch({
          confirmation: null,
          selection: {},
          needsRefresh: true,
          notice: '소유권을 이전했어요. 계정에 남은 여행을 다시 확인해 주세요.',
        });
        const refreshed = await query.refetch();
        if (valid(submitted.actorId, started) && refreshed.isSuccess)
          patch({ needsRefresh: false });
      } else {
        await submitAccountDeletion(options, submitted.policyVersion);
        if (!valid(submitted.actorId, started)) return;
        const cleared = await clearRevokedCloudSession(options.accessToken);
        // 서버 접수 뒤에도 기다리는 동안 바뀐 새 계정의 세션은 지우지 않는다.
        if (scope.current.active && cleared && authRevision() === started + 1) {
          setAcceptedRevision(started + 1);
        }
      }
    })
      ?.catch((failure: unknown) => {
        if (!valid(submitted.actorId, started)) return;
        const failureState = accountRequestFailure(failure);
        patch({
          confirmation: null,
          error: failureState.message,
          reauthenticate: failureState.reauthenticate,
          needsRefresh: failureState.refresh,
        });
      })
      .finally(() => {
        if (valid(submitted.actorId, started)) patch({ busy: false });
      });
  }
  function requestReauthentication(): void {
    if (busy || lock.current) return;
    const started = revision;
    patch({ busy: true });
    submitOnce(lock, async () => {
      await useTripStore.getState().logout();
      if (!scope.current.active || authRevision() !== started + 1) return;
      completeFormExit(() =>
        router.replace({ pathname: '/login', params: { next: 'account' } }),
      );
    })
      ?.catch(() => {
        if (valid(userId, started))
          patch({
            error: '로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
          });
      })
      .finally(() => {
        if (valid(userId, started)) patch({ busy: false });
      });
  }
  return {
    user,
    userId,
    router,
    management,
    loading,
    busy,
    error: state.error || recovery?.message || '',
    notice: state.notice,
    reauthenticate: state.reauthenticate || Boolean(recovery?.reauthenticate),
    completed,
    confirming,
    selection: state.selection,
    reload,
    chooseOwner,
    confirmTransfer,
    confirmDeletion,
    cancelConfirmation,
    confirmRequest,
    requestReauthentication,
  };
}
export type AccountRetirementController = ReturnType<
  typeof useAccountRetirement
>;
