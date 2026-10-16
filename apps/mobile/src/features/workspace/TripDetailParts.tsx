import Text from '@/components/AppText';
import HaruState from '@/components/HaruState';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { View } from 'react-native';
import type { WorkspaceExpense, WorkspaceSnapshot } from '@wherego/domain';
import { memberRoleLabel } from './presentation';
import { tripDetailStyles as s } from './tripDetailStyles';

// 통화별 소수 문자열을 센트 정수로 합산하여 기존 정밀도를 유지한다.
function expenseTotal(
  expenses: WorkspaceExpense[],
  actual: boolean,
  currency: string,
): string {
  // 환산 없이 같은 통화와 비용 구분만 합한다.
  return expenses
    .filter((item) => {
      // 실제와 예상 비용을 분리한다.
      return item.currency === currency && item.isActual === actual;
    })
    .reduce((sum, item) => {
      // 금액 문자열의 소수 두 자리를 정수로 옮긴다.
      return (
        sum +
        BigInt(
          (item.amount.split('.')[0] || '0') +
            (item.amount.split('.')[1] || '').padEnd(2, '0'),
        )
      );
    }, 0n)
    .toString()
    .padStart(3, '0')
    .replace(/(\d{2})$/, '.$1');
}

// 실제 지출과 예상 비용을 통화별로 나란히 읽을 수 있게 표시한다.
export function TripCostSummary({
  expenses,
}: {
  expenses: WorkspaceExpense[];
}) {
  // 조회에 있는 금액만 계산하며 환율이나 가짜 예산을 추가하지 않는다.
  return (
    <View style={s.summary}>
      {[true, false].map((actual) => (
        <View key={String(actual)} style={[s.card, actual && s.actual]}>
          <Text style={s.cardTitle}>{actual ? '실제 지출' : '예상 비용'}</Text>
          {['KRW', 'JPY', 'USD'].map((currency) => (
            <View key={currency} style={s.currencyRow}>
              <Text style={s.meta}>{currency}</Text>
              <Text style={s.total}>
                {expenseTotal(expenses, actual, currency)}
              </Text>
            </View>
          ))}
        </View>
      ))}
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
