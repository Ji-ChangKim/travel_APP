import Text from '@/components/AppText';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Action, Field, styles } from './ui';
import SharedPlaceInput from './SharedPlaceInput';
import { ScheduleButton, ScheduleField } from './ScheduleControls';
import { scheduleStyles as schedule } from './scheduleTheme';

// 장소 확인은 외부 Google Maps와 사용자 공유 입력으로 연결한다.
export default function PlaceSearch({
  userId,
  city,
  disabled,
  onSelect,
  initialShare,
  compact = false,
  value,
  onQueryChange,
  simple = false,
  startExpanded = false,
}: {
  userId: string;
  city: string;
  disabled: boolean;
  onSelect: (placeId: string, authoredTitle: string) => void;
  initialShare?: string;
  compact?: boolean;
  value?: string;
  onQueryChange?: (value: string) => void;
  simple?: boolean;
  startExpanded?: boolean;
}) {
  // 입력 중 자동 검색이나 유료 Places 요청을 실행하지 않는다.
  const [localQuery, setLocalQuery] = useState('');
  const query = value ?? localQuery;
  const setQuery = onQueryChange || setLocalQuery;
  const Button = compact ? ScheduleButton : Action;
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(
    Boolean(initialShare) || startExpanded,
  );
  // 외부 지도에서 장소를 확인한 다음 사용자가 일정을 작성한다.
  return (
    <View style={compact ? { gap: 12 } : styles.card}>
      {!compact && (
        <Text style={styles.title} numberOfLines={1}>
          여행할 장소 찾기
        </Text>
      )}
      {compact ? (
        <ScheduleField
          label={simple ? '일정 제목' : '장소명 또는 일정 제목'}
          accessibilityLabel="제목"
          value={query}
          onChange={setQuery}
          placeholder="어디에 가고 싶으세요?"
        />
      ) : (
        <Field label="장소 검색어" value={query} onChange={setQuery} />
      )}
      {compact && !simple && (
        <ScheduleButton
          label={
            expanded ? '지도 검색·링크 접기' : 'Google Maps로 찾거나 가져오기'
          }
          onPress={() => {
            // 직접 입력은 기본으로 두고 외부 지도 사용은 선택하게 한다.
            return setExpanded(!expanded);
          }}
        />
      )}
      {!simple && (!compact || expanded) && (
        <>
          <Button
            label="Google Maps에서 찾기"
            disabled={disabled || !query.trim()}
            onPress={() => {
              // Maps URL은 앱의 Places API를 호출하지 않는다.
              return void Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} ${query}`.trim())}`,
              ).catch(() => {
                // 입력을 유지하며 다시 시도할 수 있도록 안내한다.
                return setError('지도를 열지 못했어요. 다시 시도해 주세요.');
              });
            }}
          />
          <Text style={compact ? schedule.meta : styles.subtitle}>
            장소를 확인한 뒤 일정 제목을 입력하고 지도 위치를 선택해 주세요.
          </Text>
          <SharedPlaceInput
            userId={userId}
            disabled={disabled}
            initialText={initialShare}
            compact={compact}
            onQuery={setQuery}
            onSelect={onSelect}
          />
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
