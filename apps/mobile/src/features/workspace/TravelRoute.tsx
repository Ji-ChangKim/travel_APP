import { View } from 'react-native';
import { z } from 'zod';
import Text from '@/components/AppText';
import type { TravelLeg, TravelMode } from '@wherego/domain';
import { routeEstimateSchema } from '@wherego/validation';
import { GoogleAttribution } from './GooglePlace';
import { requestTravelRoute, type RouteSource } from './planningService';
import { usePlanningRequest } from './usePlanningRequest';
import { Action } from './ui';
import { styles } from './workspaceStyles';

// 이동수단 선택만 저장하며 매번 조회한 시간·거리만 화면에 표시한다.
export default function TravelRoute({
  source,
  leg,
  disabled = false,
  onSelect,
  saved = true,
}: {
  source: RouteSource;
  leg: Omit<TravelLeg, 'dayId'> & { dayId?: string };
  disabled?: boolean;
  saved?: boolean;
  onSelect?: (mode: TravelMode) => void;
}) {
  // 공개 화면에서는 공유자가 저장한 이동수단을 그대로 조회한다.
  const mode = leg.mode;
  return (
    <View style={styles.card}>
      <Text style={styles.subtitle}>다음 장소까지 이동</Text>
      {onSelect && (
        <View style={styles.row}>
          {(
            [
              ['WALK', '도보'],
              ['TRANSIT', '대중교통'],
              ['DRIVE', '자동차'],
            ] as const
          ).map(([value, label]) => (
            <Action
              key={value}
              label={label}
              selected={saved && mode === value}
              selectionStyle="fill"
              disabled={disabled}
              onPress={() => {
                // 수단 변경은 기존 명령의 버전·멱등 저장을 거친다.
                onSelect(value);
              }}
            />
          ))}
        </View>
      )}
      {saved ? (
        <RouteResult
          key={`${mode}:${disabled}`}
          source={source}
          leg={{ ...leg, mode }}
          disabled={disabled}
        />
      ) : (
        <Text style={styles.subtitle}>
          이동수단을 선택하면 구간을 저장하고 이동시간을 조회할 수 있어요.
        </Text>
      )}
    </View>
  );
}
// 조회 실패를 임의의 속도·직선 거리로 대체하지 않는다.
function RouteResult({
  source,
  leg,
  disabled,
}: {
  source: RouteSource;
  leg: Omit<TravelLeg, 'dayId'> & { dayId?: string };
  disabled: boolean;
}) {
  // 화면 종료·다른 이동수단 선택·백그라운드에서는 요청을 취소한다.
  const request = usePlanningRequest<z.infer<typeof routeEstimateSchema>>(
    '이동 경로를 찾지 못했어요. 이동수단을 바꾸거나 잠시 후 다시 조회해 주세요.',
  );
  return (
    <>
      <Action
        label={request.busy ? '이동시간 조회 중…' : '실제 이동시간 조회'}
        disabled={disabled || request.busy}
        loading={request.busy}
        onPress={() => {
          void request.run((signal) => requestTravelRoute(source, leg, signal));
        }}
      />
      {request.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {request.error}
        </Text>
      ) : null}
      {request.result && (
        <>
          <Text>
            {Math.ceil(request.result.durationSeconds / 60)}분 ·{' '}
            {(request.result.distanceMeters / 1000).toLocaleString('ko-KR', {
              maximumFractionDigits: 1,
            })}
            km ·{' '}
            {{ WALK: '도보', DRIVE: '자동차', TRANSIT: '대중교통' }[leg.mode]}
          </Text>
          <Text style={styles.subtitle}>
            {new Date(request.result.queriedAt).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            조회 기준 예상 시간이에요. 교통과 운행 상황에 따라 달라져요.
          </Text>
          <GoogleAttribution />
        </>
      )}
    </>
  );
}
