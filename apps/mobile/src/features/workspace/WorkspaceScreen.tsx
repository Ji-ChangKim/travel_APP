import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { readCreationDrafts } from './creationDraftStorage';
import { creationDraftForm } from './creationDraftModel';
import { restoreCreation } from './creationAuthHandoff';
import { Action } from './ui';
import type { PlanForm } from './forms';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { useAuthReady } from '../auth/AuthBridge';
import HaruState from '@/components/HaruState';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import WorkspaceView from './WorkspaceView';
import { useWorkspaceController } from './useWorkspaceController';

// 인증 복원과 계정·여행별 화면 수명을 연결한다.
export default function WorkspaceScreen({
  creating = false,
}: {
  creating?: boolean;
}) {
  useLocale();
  // 계정·여행 경로가 바뀌면 비공개 폼·재시도 상태를 새 화면으로 교체한다.
  const userId = useTripStore((state) => {
    // 게스트와 로그인 계정의 작성 상태를 분리한다.
    return state.currentUser?.id || 'public';
  });
  const authReady = useAuthReady((state) => {
    // 새로고침 복원이 끝나기 전에는 로그인 필요 화면을 먼저 내보내지 않는다.
    return state.ready;
  });
  const { id, importPlace, destination, mode, resume, handoff } =
    useLocalSearchParams<{
      id?: string;
      importPlace?: string;
      destination?: string;
      mode?: string;
      resume?: string;
      handoff?: string;
    }>();
  // 글꼴은 상위 AppFontProvider가 준비하며, 상세 직접 진입에서 중복 로딩을 기다리지 않는다.
  // React key로 이전 계정의 입력·요청 클로저를 남기지 않는다.
  return !authReady ? (
    <HaruState kind="loading" title={t('여행을 불러오는 중입니다.')} compact />
  ) : (
    <WorkspaceEntry
      key={`${userId}:${creating ? `new:${destination || ''}:${mode || ''}:${resume || ''}:${handoff || ''}` : id || 'list'}:${importPlace || ''}`}
      userId={userId}
      resume={resume}
      handoff={handoff}
      creating={creating}
      importing={importPlace === '1'}
    />
  );
}
// 계정·여행별 컨트롤러를 같은 수명의 표현 화면에 연결한다.
function WorkspaceContent(props: {
  creating: boolean;
  importing: boolean;
  initialForm?: PlanForm;
}) {
  useLocale();
  // 훅은 조건 없이 호출하고 기존 계정·경로 key가 초안과 요청 수명을 분리한다.
  return <WorkspaceView {...useWorkspaceController(props)} />;
}

// 초안 복원이 끝나기 전에 빈 생성 폼을 먼저 마운트하지 않는다.
function WorkspaceEntry({
  userId,
  resume,
  handoff,
  ...props
}: {
  userId: string;
  resume?: string;
  handoff?: string;
  creating: boolean;
  importing: boolean;
}) {
  const router = useRouter();
  const memberId = useTripStore((state) =>
    state.currentUser?.authProvider !== 'guest'
      ? state.currentUser?.id
      : undefined,
  );
  const [restoredForm] = useState(() =>
    props.creating && handoff && !resume
      ? restoreCreation(handoff, memberId)
      : undefined,
  );
  const query = useQuery({
    gcTime: 0,
    queryKey: ['creation-draft-resume', userId, resume],
    queryFn: () => readCreationDrafts(userId),
    enabled: Boolean(props.creating && resume),
    retry: false,
    // 편집 중 서버 초안을 다시 적용하지 않는다. 버전 충돌은 저장할 때 확인한다.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (props.creating && resume) {
    if (query.isPending)
      return (
        <HaruState kind="loading" title={t('임시 계획 불러오는 중…')} compact />
      );
    if (query.isError && !query.data)
      return (
        <HaruState
          kind="error"
          title={t('임시 계획을 불러오지 못했어요.')}
          compact
        >
          <Action
            label={t('임시 계획 다시 불러오기')}
            onPress={() => void query.refetch()}
          />
          <Action
            label={t('계획 만들기로 돌아가기')}
            onPress={() => router.replace('/(tabs)')}
          />
        </HaruState>
      );
    const draft = query.data?.find((item) => item.form.id === resume);
    if (!draft)
      return (
        <HaruState
          kind="error"
          title={t('저장된 임시 계획을 찾을 수 없어요.')}
          compact
        >
          <Action
            label={t('계획 만들기로 돌아가기')}
            onPress={() => router.replace('/(tabs)')}
          />
        </HaruState>
      );
    return (
      <WorkspaceContent {...props} initialForm={creationDraftForm(draft)} />
    );
  }
  if (props.creating && handoff) {
    const initialForm = restoredForm;
    if (!initialForm)
      return (
        <HaruState
          kind="error"
          title={t(
            '작성하던 내용을 이어 불러올 수 없어요. 다시 시작해 주세요.',
          )}
          compact
        >
          <Action
            label={t('새 계획 만들기')}
            onPress={() => router.replace('/new-trip')}
          />
        </HaruState>
      );
    return <WorkspaceContent {...props} initialForm={initialForm} />;
  }
  return <WorkspaceContent {...props} />;
}
