import { t } from '@/features/localization/translate';
import Text from '@/components/AppText';

import { View } from 'react-native';

import TripFlightList from './TripFlightList';

import { travelDateRange } from './travelDateRange';

import { Action } from './ui';
import { styles } from './workspaceStyles';
import type { RenderTripPlanningProps } from './tripPlanningViewTypes';
// 선택 항공편을 확인하고 기존 생성·재시도 행동으로 연결한다.
export default function TripPlanningFlights({
  props,
  items,
  setSlot,
  recording,
}: Pick<RenderTripPlanningProps, 'props' | 'items' | 'setSlot' | 'recording'>) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>
          {props.form.values.title || t('여행 이름은 자동으로 정해요')}
        </Text>
        <Text>
          {[props.form.values.country, props.form.values.city]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text style={styles.subtitle}>
          {travelDateRange(
            props.form.values.startDate!,
            props.form.values.endDate!,
          )}
        </Text>
        <Text style={styles.subtitle}>
          {t('항공편은 선택 사항이에요. 여행을 만든 뒤에도 추가할 수 있어요.')}
        </Text>
      </View>
      <TripFlightList
        items={items}
        onEdit={setSlot}
        onRemove={(index) => {
          // 삭제한 슬롯만 비우고 다른 구간과 여행 초안을 유지한다.
          return props.onChange(
            'flights',
            JSON.stringify(items.filter((_, position) => position !== index)),
          );
        }}
      />
      {props.locked && !props.busy ? (
        <Action
          label={t('다시 저장하기')}
          allowWhileLocked
          variant="primary"
          onPress={props.onSave}
        />
      ) : items.length ? (
        <Action
          label={
            props.busy
              ? t('저장 중…')
              : recording
                ? t('여행 기록 만들기')
                : t('여행 만들기')
          }
          variant="primary"
          loading={props.busy}
          allowWhileLocked
          onPress={props.onSave}
        />
      ) : (
        <Action
          label={props.busy ? t('저장 중…') : t('항공편 없이 여행 만들기')}
          loading={props.busy}
          variant="primary"
          disabled={props.locked && !props.busy}
          onPress={() => {
            // 이미 확인한 내용은 불필요한 확인 팝업 없이 실제 생성한다.
            return props.onSave();
          }}
        />
      )}
    </>
  );
}
