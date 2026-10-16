import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { View } from 'react-native';
import { useState } from 'react';
import { Action } from './ui';
import { diaryCosts } from './diary';
import type { WorkspaceExpense, WorkspaceSnapshot } from '@wherego/domain';
import { memberRoleLabel } from './presentation';
import { tripDetailStyles as s } from './tripDetailStyles';

// 실제 지출과 예상 비용을 통화별로 나란히 읽을 수 있게 표시한다.
export function TripCostSummary({
  expenses,
}: {
  expenses: WorkspaceExpense[];
}) {
  // 조회에 있는 금액만 계산하며 환율이나 가짜 예산을 추가하지 않는다.
  const [showEstimates, setShowEstimates] = useState(false);
  const actualCosts = diaryCosts(expenses);
  const estimatedCosts = diaryCosts(expenses, false);
  return (
    <View style={s.summary}>
      <View style={[s.card, s.actual]}>
        <Text style={s.cardTitle}>실제 지출</Text>
        {!actualCosts.length && (
          <Text style={s.meta}>아직 기록한 지출이 없어요.</Text>
        )}
        {actualCosts.map((cost) => (
          <View key={cost.currency} style={s.currencyRow}>
            <Text style={s.meta}>{cost.currency}</Text>
            <Text style={s.total}>{cost.amount}</Text>
          </View>
        ))}
      </View>
      {estimatedCosts.length > 0 && (
        <Action
          label={showEstimates ? '예상 비용 접기' : '예상 비용 보기'}
          onPress={() => {
            // 실제 지출을 먼저 읽고 필요한 경우에만 예상 비용을 펼친다.
            return setShowEstimates(!showEstimates);
          }}
        />
      )}
      {showEstimates && estimatedCosts.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>예상 비용</Text>
          {estimatedCosts.map((cost) => (
            <View key={cost.currency} style={s.currencyRow}>
              <Text style={s.meta}>{cost.currency}</Text>
              <Text style={s.total}>{cost.amount}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={s.meta}>
        통화별로 모았어요. 서로 다른 통화는 합산하지 않아요.
      </Text>
    </View>
  );
}

// 비용 이름·금액·기록 출처를 서로 다른 글자 역할로 표시한다.
export function TripExpenseHeading({
  item,
  scheduleTitle,
}: {
  item: WorkspaceExpense;
  scheduleTitle?: string;
}) {
  // 영수증 비용과 직접 입력한 비용의 차이를 실제 출처로 안내한다.
  return (
    <View style={{ gap: 8 }}>
      <View style={s.heading}>
        <View style={s.badge}>
          <Text style={s.badgeText}>
            {item.isActual ? '실제 지출' : '예상 비용'}
          </Text>
        </View>
        <Text style={s.meta}>
          {item.source === 'manual' ? '직접 기록' : '영수증에서 기록'}
        </Text>
      </View>
      <Text style={s.cardTitle}>{item.title}</Text>
      <Text style={s.amount}>
        {item.currency} {item.amount}
      </Text>
      {scheduleTitle ? (
        <Text style={s.meta}>연결한 일정 · {scheduleTitle}</Text>
      ) : null}
    </View>
  );
}

// 저장된 준비물의 완료 개수와 전체 개수를 함께 표시한다.
export function TripChecklistProgress({
  items,
}: {
  items: WorkspaceSnapshot['checklists'];
}) {
  // 빈 목록을 준비 완료로 표시하지 않는다.
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>준비물</Text>
      <Text style={s.meta} accessibilityLiveRegion="polite">
        {
          items.filter((item) => {
            /* 저장된 완료 상태만 센다. */ return item.isCompleted;
          }).length
        }{' '}
        / {items.length}개 준비했어요
      </Text>
      <View accessible={false} style={s.progressTrack}>
        <View
          style={[
            s.progressFill,
            {
              width: `${
                items.length
                  ? (items.filter((item) => {
                      /* 전체 대비 실제 완료 비율을 표시한다. */ return item.isCompleted;
                    }).length /
                      items.length) *
                    100
                  : 0
              }%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

// 동행자의 실제 닉네임과 할 수 있는 행동을 표시한다.
export function TripMemberHeading({
  member,
}: {
  member: WorkspaceSnapshot['members'][number];
}) {
  const { largeText } = useAppAccessibility();
  // 접속 상태나 사진을 임의로 만들지 않고 닉네임 첫 글자를 사용한다.
  return (
    <View
      style={[
        s.heading,
        largeText && { flexDirection: 'column', alignItems: 'stretch' },
      ]}
    >
      <View accessible={false} style={[s.avatar, { alignSelf: 'flex-start' }]}>
        <Text style={s.initial}>{[...member.nickname.trim()][0] || '여'}</Text>
      </View>
      <View style={s.memberInfo}>
        <Text style={s.cardTitle}>
          {member.nickname}
          {member.isMe ? ' (나)' : ''}
        </Text>
        <Text style={s.meta}>{memberRoleLabel(member.role)}</Text>
      </View>
    </View>
  );
}

// 빈 정보 영역을 원본 하루와 다음 행동의 안내로 표시한다.
export function TripDetailEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  // 예시 데이터를 채우지 않고 현재 조회 결과만 설명한다.
  return (
    <HaruState kind="empty" title={title} description={description} compact />
  );
}
