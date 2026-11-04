import { getLocale, useLocale } from '@/features/localization/localeState';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { TravelLeg, TravelMode } from '@wherego/domain';
import { routeEstimateSchema } from '@wherego/validation';
import { GoogleAttribution } from './schedule/ui/GooglePlace';
import { requestTravelRoute, type RouteSource } from './planningService';
import { usePlanningRequest } from './usePlanningRequest';
import { Action } from './ui';
import { styles } from './hub/styles/workspaceStyles';

const routeStyles = StyleSheet.create({
  connector: {
    padding: 12,
    gap: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandCoral,
  },
  routeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  resultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.selectedSurface,
    alignSelf: 'flex-start',
  },
  resultText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
  },
});

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
  useLocale();
  // 공개 화면에서는 공유자가 저장한 이동수단을 그대로 조회한다.
  const mode = leg.mode;
  return (
    <View style={routeStyles.connector}>
      <View style={routeStyles.routeTopRow}>
        <Ionicons
          name="swap-vertical-outline"
          size={14}
          color={colors.secondary}
          accessible={false}
        />
        <Text style={routeStyles.routeLabel}>{t('다음 장소까지 이동')}</Text>
      </View>
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
          {t(
            '이동수단을 선택하면 구간을 저장하고 이동시간을 조회할 수 있어요.',
          )}
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
  useLocale();
  // 화면 종료·다른 이동수단 선택·백그라운드에서는 요청을 취소한다.
  const request = usePlanningRequest<z.infer<typeof routeEstimateSchema>>(
    '이동 경로를 찾지 못했어요. 이동수단을 바꾸거나 잠시 후 다시 조회해 주세요.',
  );
  return (
    <>
      <Action
        label={request.busy ? t('이동시간 조회 중…') : t('실제 이동시간 조회')}
        disabled={disabled || request.busy}
        loading={request.busy}
        onPress={() => {
          void request.run((signal) => requestTravelRoute(source, leg, signal));
        }}
      />
      {request.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(request.error)}
        </Text>
      ) : null}
      {request.result && (
        <>
          <View style={routeStyles.resultPill}>
            <Text style={routeStyles.resultText}>
              {Math.ceil(request.result.durationSeconds / 60)}
              {t('분 ·')}{' '}
              {(request.result.distanceMeters / 1000).toLocaleString(
                getLocale(),
                {
                  maximumFractionDigits: 1,
                },
              )}
              km ·{' '}
              {{ WALK: '도보', DRIVE: '자동차', TRANSIT: '대중교통' }[leg.mode]}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {new Date(request.result.queriedAt).toLocaleTimeString(
              getLocale(),
              {
                hour: '2-digit',
                minute: '2-digit',
              },
            )}{' '}
            {t('조회 기준 예상 시간이에요. 교통과 운행 상황에 따라 달라져요.')}
          </Text>
          <GoogleAttribution />
        </>
      )}
    </>
  );
}
