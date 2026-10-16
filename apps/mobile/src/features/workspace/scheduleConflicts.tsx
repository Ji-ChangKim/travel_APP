import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { WorkspaceSchedule } from '@wherego/domain';
import { Pressable, View } from 'react-native';
import { useState } from 'react';
import { scheduleStyles as s } from './scheduleTheme';

import { scheduleConflicts } from './scheduleTimeConflicts';

// 충돌을 고칠 수 있도록 예정 시각이 자동 변경되지 않음을 안내한다.
export default function ScheduleConflictNotice({
  items,
}: {
  items: WorkspaceSchedule[];
}) {
  // 같은 장소가 포함된 긴 일정도 요약 후 개수를 알린다.
  const messages = scheduleConflicts(items);
  const [expanded, setExpanded] = useState(false);
  return messages.length ? (
    <View
      accessibilityRole="alert"
      style={{
        padding: 12,
        gap: 6,
        backgroundColor: colors.warningSoft,
        borderRadius: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="시간 경고 자세히"
        accessibilityState={{ expanded }}
        style={{ minHeight: 44, justifyContent: 'center' }}
        onPress={() => {
          // 긴 경고가 일정을 가리지 않게 상세는 선택해서 읽는다.
          return setExpanded(!expanded);
        }}
      >
        <Text style={s.label}>
          방문 시간 {messages.length}건 확인 · {expanded ? '접기' : '자세히'}
        </Text>
      </Pressable>
      {expanded && (
        <>
          {messages.slice(0, 3).map((message, index) => (
            <Text key={index} style={s.meta}>
              {message}
            </Text>
          ))}
          {messages.length > 3 && (
            <Text style={s.meta}>
              추가로 {messages.length - 3}건의 시간이 겹치거나 순서와 달라요.
            </Text>
          )}
          <Text style={s.meta}>
            예정 시각은 자동으로 바뀌지 않아요. 시간이나 방문 순서를 수정할 수
            있어요.
          </Text>
        </>
      )}
    </View>
  ) : null;
}
