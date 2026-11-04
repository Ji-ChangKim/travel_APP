import { t } from '@/features/localization/translate';

import Text from '@/components/ui/AppText';

import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import type { ImperativeRouter } from 'expo-router';

import { View } from 'react-native';
import PublishReadiness from '../../community/ui/PublishReadiness';
import PublishedPlanActions from '../../community/ui/PublishedPlanActions';

import { Action } from '../../shared/ui/ui';
import type { WorkspaceDraftKind } from '../model/workspaceDrafts';
import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';
import { styles } from '../styles/workspaceStyles';

type RenderWorkspaceSharingProps = {
  owner: boolean;
  activeSection: string;
  router: ImperativeRouter;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  actions: WorkspaceScreenActions;
};

// 여행 공유와 공개 관리 행동을 표시한다.
export function renderWorkspaceSharing({
  owner,
  activeSection,
  router,
  snapshot,
  busy,
  scanning,
  hasPending,
  openDraft,
  actions,
}: RenderWorkspaceSharingProps) {
  return (
    owner &&
    activeSection === 'share' && (
      <View style={styles.card}>
        <Text style={styles.title}>{t('선택해서 공유')}</Text>
        <Action
          label={t('공개된 여행 둘러보기')}
          variant="quiet"
          onPress={() => {
            // 공개된 여행을 확인할 수 있는 피드로 이동한다.
            return router.push('/(tabs)/community');
          }}
        />
        <Text>
          {t(
            '공개할 일정·사진·금액을 직접 골라 주세요. 게시하지 않아도 개인 기록은 남아요.',
          )}
        </Text>
        {snapshot.postId && (
          <>
            <Text style={styles.subtitle}>
              {t(
                '다시 공개하면 같은 링크의 내용이 새 선택으로 바뀌어요. 여행계획과 여행기록은 한 여행당 하나만 공개돼요.',
              )}
            </Text>
            <Action
              label={t('내 공개 화면 보기')}
              variant="quiet"
              onPress={() => {
                // 공개본 ID는 원본 여행의 서버 응답에서만 읽는다.
                return router.push({
                  pathname: '/community/[postId]',
                  params: { postId: snapshot.postId! },
                });
              }}
            />
            <PublishedPlanActions
              key={snapshot.postId}
              title={snapshot.trip.title}
              postId={snapshot.postId}
              disabled={busy || scanning || hasPending}
            />
          </>
        )}
        <Action
          label={t('여행계획 공유하기')}
          disabled={
            snapshot.trip.status === 'ARCHIVED' ||
            busy ||
            scanning ||
            hasPending
          }
          onPress={() => {
            // 다녀온 기록으로 바꾸지 않고 계획 자체의 공개 내용을 선택한다.
            return openDraft('plan-share');
          }}
        />
        {snapshot.trip.status !== 'COMPLETED' &&
          snapshot.trip.status !== 'ARCHIVED' && (
            <PublishReadiness
              disabled={busy || scanning || hasPending}
              onComplete={actions.completeTrip}
            />
          )}
        <Action
          label={
            snapshot.postId
              ? t('여행기록으로 바꿔 공유')
              : t('여행기록 공유하기')
          }
          disabled={snapshot.trip.status !== 'COMPLETED' || busy || hasPending}
          onPress={() => {
            // 새 공개 폼은 모든 민감 항목을 선택 해제한다.
            openDraft('record-share');
          }}
        />
        {snapshot.postId && (
          <Action
            variant="danger"
            label={t('공개 중단')}
            disabled={busy || scanning || hasPending}
            onPress={actions.withdraw}
          />
        )}
      </View>
    )
  );
}
