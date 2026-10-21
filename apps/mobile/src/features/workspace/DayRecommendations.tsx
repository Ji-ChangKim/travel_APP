import { useState } from 'react';
import { View } from 'react-native';
import { z } from 'zod';
import Text from '@/components/AppText';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { destinationForDay } from '@wherego/domain';
import { recommendationResultSchema } from '@wherego/validation';
import { GoogleAttribution } from './GooglePlace';
import { requestRecommendations } from './planningService';
import { usePlanningRequest } from './usePlanningRequest';
import { Action } from './ui';
import { styles } from './workspaceStyles';

export type RecommendedPlace = z.infer<
  typeof recommendationResultSchema
>['items'][number];
// 추천을 자동 저장하지 않고 기존 일정 작성으로 이어 준다.
export default function DayRecommendations({
  snapshot,
  dayId,
  userId,
  disabled,
  onChoose,
}: {
  snapshot: WorkspaceSnapshot;
  dayId: string;
  userId: string;
  disabled: boolean;
  onChoose: (item: RecommendedPlace) => void;
}) {
  // 관심사나 속도를 바꾸면 이전 결과와 요청을 폐기한다.
  const [open, setOpen] = useState(false);
  const [interest, setInterest] = useState('sights');
  const [pace, setPace] = useState('balanced');
  return (
    <View style={styles.card}>
      <Action
        label={open ? 'AI 장소 추천 접기' : 'AI 장소 추천'}
        disabled={disabled}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Text>
            {destinationForDay(snapshot, dayId).city}에서 가보고 싶은 곳을 골라
            주세요.
          </Text>
          <View style={styles.row}>
            {[
              ['sights', '명소'],
              ['food', '맛집'],
              ['cafe', '카페'],
              ['nature', '자연'],
              ['culture', '문화'],
            ].map(([value, label]) => (
              <Action
                key={value}
                label={label!}
                selected={interest === value}
                selectionStyle="fill"
                disabled={disabled}
                onPress={() => setInterest(value!)}
              />
            ))}
          </View>
          <View style={styles.row}>
            {[
              ['relaxed', '여유롭게'],
              ['balanced', '적당히'],
              ['active', '알차게'],
            ].map(([value, label]) => (
              <Action
                key={value}
                label={label!}
                selected={pace === value}
                selectionStyle="fill"
                disabled={disabled}
                onPress={() => setPace(value!)}
              />
            ))}
          </View>
          <RecommendationResults
            key={`${snapshot.trip.version}:${userId}:${dayId}:${interest}:${pace}:${disabled}`}
            {...{ snapshot, dayId, userId, disabled, interest, pace, onChoose }}
          />
        </>
      )}
    </View>
  );
}

// 실제 검색 결과는 저장 전 장소명과 주소를 확인할 수 있게 표시한다.
function RecommendationResults({
  snapshot,
  dayId,
  userId,
  disabled,
  interest,
  pace,
  onChoose,
}: {
  snapshot: WorkspaceSnapshot;
  dayId: string;
  userId: string;
  disabled: boolean;
  interest: string;
  pace: string;
  onChoose: (item: RecommendedPlace) => void;
}) {
  // AI의 검색 방향과 Google 장소 결과를 공급자 정보와 함께 표시한다.
  const request = usePlanningRequest<
    z.infer<typeof recommendationResultSchema>
  >(
    '장소를 추천하지 못했어요. 잠시 후 다시 시도하거나 장소를 직접 검색해 주세요.',
  );
  return (
    <>
      <Text style={styles.subtitle}>
        AI가 관심사에 맞는 검색 방향을 정해요. 장소와 영업 정보는 방문 전 확인해
        주세요.
      </Text>
      <Action
        label={request.busy ? '장소 찾는 중…' : '추천 장소 찾기'}
        loading={request.busy}
        disabled={disabled || request.busy}
        onPress={() => {
          void request.run((signal) =>
            requestRecommendations(
              userId,
              snapshot.trip.id,
              { dayId, interest, pace },
              signal,
            ),
          );
        }}
      />
      {request.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {request.error}
        </Text>
      ) : null}
      {request.result?.tripVersion === snapshot.trip.version && (
        <>
          {!request.result.items.length && (
            <Text>
              새로 추천할 장소를 찾지 못했어요. 다른 관심사를 선택하거나 직접
              검색해 주세요.
            </Text>
          )}
          {request.result.items.map((item) => (
            <View key={item.placeId} style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text>{item.address}</Text>
              <Text style={styles.subtitle}>{item.reason}</Text>
              <GoogleAttribution attributions={item.attributions} />
              <Action
                label={`${item.title} 일정 작성`}
                disabled={disabled}
                onPress={() => onChoose(item)}
              />
            </View>
          ))}
        </>
      )}
    </>
  );
}
