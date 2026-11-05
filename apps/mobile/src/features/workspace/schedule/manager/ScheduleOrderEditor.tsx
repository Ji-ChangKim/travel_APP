import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceSnapshot } from '@wherego/domain';
import AppModal from '@/components/ui/AppModal';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import DesignButton from '@/components/ui/DesignButton';
import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { schedulesForDay } from '../model/schedulePresentation';
import { moveScheduleOrder, orderedSchedules } from '../model/scheduleOrder';
import { schedulePageStyles as s } from '../styles/schedulePageStyles';
import {
  requestScheduleExit,
  useScheduleExitGuard,
} from '../ui/scheduleExitGuard';

export default function ScheduleOrderEditor(props: {
  snapshot: WorkspaceSnapshot;
  dayId: string;
  busy: boolean;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (ids: string[], done: () => void) => void;
  onRetry: () => void;
  onReload: () => void;
}) {
  useLocale();
  const items = schedulesForDay(props.snapshot.itinerary, props.dayId);
  const [ids, setIds] = useState(() => items.map((item) => item.id));
  const [baseVersion] = useState(props.snapshot.trip.version);
  const stale = baseVersion !== props.snapshot.trip.version;
  const locked = props.busy || props.pending;
  const form = { kind: 'schedule-order', id: props.dayId, values: { ids } };
  useScheduleExitGuard(form, locked, props.onClose);
  const close = () => requestScheduleExit(props.onClose);
  return (
    <AppModal
      native
      visible
      accessibilityLabel={t('순서 편집')}
      onRequestClose={close}
    >
      <SafeAreaView style={s.page}>
        <ScreenHeader title={t('순서 편집')} onBack={close} disabled={locked} />
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.body}>
            {t(
              '화살표로 방문 순서를 바꾼 뒤 순서 저장을 눌러 주세요. 예정 시간은 그대로 유지돼요.',
            )}
          </Text>
          {orderedSchedules(items, ids).map((item, index) => (
            <View key={item.id} style={s.card}>
              <Text style={s.title}>
                {index + 1}. {item.title}
              </Text>
              <Text style={s.meta}>{item.timeSlot || t('시간 미정')}</Text>
              <View style={s.row}>
                <DesignButton
                  label={t('{title} 위로 이동', { title: item.title })}
                  disabled={locked || stale || index === 0}
                  onPress={() => setIds(moveScheduleOrder(ids, item.id, -1))}
                />
                <DesignButton
                  label={t('{title} 아래로 이동', { title: item.title })}
                  disabled={locked || stale || index === items.length - 1}
                  onPress={() => setIds(moveScheduleOrder(ids, item.id, 1))}
                />
              </View>
            </View>
          ))}
          {stale && (
            <Text accessibilityRole="alert" style={s.error}>
              {t(
                '일정이 바뀌었어요. 취소한 뒤 최신 목록에서 순서를 다시 정해 주세요.',
              )}
            </Text>
          )}
          {props.error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {props.error}
            </Text>
          ) : null}
          {props.pending && !props.busy && (
            <DesignButton label={t('다시 저장하기')} onPress={props.onRetry} />
          )}
          {props.error && !props.busy && (
            <DesignButton
              label={t('최신 내용 불러오기')}
              onPress={props.onReload}
            />
          )}
        </ScrollView>
        <View style={s.footer}>
          <View style={s.button}>
            <DesignButton
              label={t('취소')}
              disabled={locked}
              onPress={props.onClose}
            />
          </View>
          <View style={s.button}>
            <DesignButton
              label={props.busy ? t('저장 중…') : t('순서 저장')}
              variant="primary"
              disabled={locked || stale}
              onPress={() => props.onSave(ids, props.onClose)}
            />
          </View>
        </View>
      </SafeAreaView>
    </AppModal>
  );
}
