import { t } from '@/features/localization/translate';

import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';

import { Ionicons } from '@expo/vector-icons';

import type { WorkspaceSnapshot } from '@wherego/domain';

import { View } from 'react-native';

import {
  TripChecklistProgress,
  TripDetailEmpty,
} from '../../my-trips/ui/TripDetailParts';

import { tripDetailStyles as detail } from '../../my-trips/styles/tripDetailStyles';

import { Action, Field } from '../../shared/ui/ui';

import { styles } from '../styles/workspaceStyles';

type RenderWorkspaceChecklistProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  check: (item: { id: string; isCompleted: boolean }) => void;
  checklist: string;
  changeChecklist: (value: string) => void;
  checklistError: string;
  addCheck: () => void;
};

// 준비물 상태와 추가 입력을 표시한다.
export function renderWorkspaceChecklist({
  activeSection,
  snapshot,
  writable,
  busy,
  scanning,
  hasPending,
  check,
  checklist,
  changeChecklist,
  checklistError,
  addCheck,
}: RenderWorkspaceChecklistProps) {
  return (
    activeSection === 'preparation' && (
      <View testID="trip-checklist-panel" style={detail.section}>
        <TripChecklistProgress items={snapshot.checklists} />
        {!snapshot.checklists.length && (
          <TripDetailEmpty
            title={t('아직 준비물이 없어요')}
            description={
              writable
                ? t(
                    '아래에 챙길 물건을 적어보세요. 준비한 항목은 체크할 수 있어요.',
                  )
                : t('동행자가 추가한 준비물을 여기서 함께 확인해요.')
            }
          />
        )}
        {snapshot.checklists.map((item) => (
          <DesignButton
            key={item.id}
            label={item.title}
            accessibilityLabel={`${item.isCompleted ? '✓ ' : '□ '}${item.title}`}
            checked={item.isCompleted}
            selected={item.isCompleted}
            icon={(color) => {
              /* 완료 전에도 체크 위치를 읽기 쉬운 선으로 표시한다. */ return (
                <Ionicons name="square-outline" size={20} color={color} />
              );
            }}
            disabled={!writable || busy || scanning || hasPending}
            onPress={() => {
              // 권한·버전 검증을 포함해 완료 상태를 저장한다.
              check(item);
            }}
          />
        ))}
        {writable && (
          <>
            <Field
              label="새 준비물"
              disabled={busy || scanning || hasPending}
              value={checklist}
              onChange={(value) => {
                /* 대기 중인 준비물 요청과 입력을 섞지 않는다. */ return changeChecklist(
                  value,
                );
              }}
            />
            {checklistError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {checklistError}
              </Text>
            ) : null}
            <Action
              label={t('준비물 추가')}
              variant="primary"
              disabled={busy || scanning || hasPending}
              onPress={addCheck}
            />
          </>
        )}
      </View>
    )
  );
}
