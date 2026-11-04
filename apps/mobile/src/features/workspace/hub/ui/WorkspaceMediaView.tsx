import WorkspaceReceiptCard from './WorkspaceReceiptCard';
import { workspaceMediaSelection } from '../model/workspaceMediaSelection';
import { t } from '@/features/localization/translate';

import Text from '@/components/ui/AppText';

import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';

import type { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';

import ServerPhoto from '../../schedule/ui/ServerPhoto';

import { Action } from '../../shared/ui/ui';
import type { WorkspaceDraftKind } from '../model/workspaceDrafts';
import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';
import { styles } from '../styles/workspaceStyles';

type RenderWorkspacePhotosProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  userId: string;
  retryReceipt: (mediaId: string) => void;
  actions: WorkspaceScreenActions;
};

// 등록 사진과 영수증 기록을 표시한다.
export function renderWorkspacePhotos({
  activeSection,
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  userId,
  retryReceipt,
  actions,
}: RenderWorkspacePhotosProps) {
  const mediaSelection = workspaceMediaSelection(snapshot);
  const disabled = !writable || busy || scanning || hasPending;
  return (
    activeSection === 'photos' && (
      <View style={styles.card}>
        <Text style={styles.title}>{t('사진 · 영수증')}</Text>
        {mediaSelection.informationOnly.map((receipt) => (
          <WorkspaceReceiptCard
            key={receipt.id}
            receipt={receipt}
            informationOnly
            disabled={disabled}
            actions={actions}
          />
        ))}
        {mediaSelection.mediaEntries.map(
          ({ media, receipts, needsReceiptReview }) => (
            <View key={media.id} style={{ gap: 10 }}>
              <ServerPhoto
                userId={userId}
                tripId={snapshot.trip.id}
                mediaId={media.id}
              />
              <Text>
                {media.purpose === 'receipt'
                  ? t('비공개 영수증')
                  : t('여행 사진')}
              </Text>
              {needsReceiptReview && (
                <Action
                  label={t('영수증 확인 / 인식 재시도')}
                  disabled={disabled}
                  onPress={() => retryReceipt(media.id)}
                />
              )}
              {receipts.map((receipt) => (
                <WorkspaceReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  disabled={disabled}
                  actions={actions}
                />
              ))}
              <Action
                variant="danger"
                label={t('사진 등록 삭제')}
                disabled={disabled}
                onPress={() => actions.deleteMedia(media)}
              />
            </View>
          ),
        )}
      </View>
    )
  );
}

type RenderWorkspaceCaptureProps = {
  activeSection: string;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  openDraft: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  photo: (
    purpose: 'photo' | 'receipt',
    camera?: boolean,
    scheduleId?: string,
  ) => void;
  setShowReceiptCapture: Dispatch<SetStateAction<boolean>>;
};

// 비용·사진·영수증 등록 진입을 표시한다.
export function renderWorkspaceCapture({
  activeSection,
  writable,
  busy,
  scanning,
  hasPending,
  openDraft,
  photo,
  setShowReceiptCapture,
}: RenderWorkspaceCaptureProps) {
  return (
    ['expenses', 'photos'].includes(activeSection) && (
      <View style={styles.row}>
        {activeSection === 'expenses' && (
          <Action
            variant="primary"
            label={t('비용 추가')}
            disabled={!writable || busy || scanning || hasPending}
            onPress={() => {
              // 실제 비용과 예상 비용은 명시적으로 구분한다.
              openDraft('expense');
            }}
          />
        )}
        {activeSection === 'photos' && (
          <Action
            variant="primary"
            label={t('사진 추가')}
            disabled={!writable || busy || scanning || hasPending}
            onPress={() => {
              // 사진은 멤버만 읽는 비공개 원본으로 업로드한다.
              photo('photo');
            }}
          />
        )}
        <Action
          label={t('영수증 촬영')}
          disabled={!writable || busy || scanning || hasPending}
          onPress={() => {
            // 촬영 안내를 확인한 뒤 실제 기기 카메라로 진행한다.
            return setShowReceiptCapture(true);
          }}
        />
        <Action
          label={t('영수증 사진 선택')}
          disabled={!writable || busy || scanning || hasPending}
          onPress={() => {
            // 기존 촬영 영수증도 같은 확인 절차를 사용한다.
            photo('receipt');
          }}
        />
      </View>
    )
  );
}
