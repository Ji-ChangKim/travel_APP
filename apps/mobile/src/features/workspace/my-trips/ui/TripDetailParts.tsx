import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';
import HaruState from '@/components/feedback/HaruState';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { View } from 'react-native';
import { useState } from 'react';
import { Action } from '../../shared/ui/ui';
import { trackWorkspaceEvent } from '../../shared/model/workspaceAnalytics';
import { diaryCosts } from '../model/diary';
import type { WorkspaceExpense, WorkspaceSnapshot } from '@wherego/domain';
import { memberRoleLabel } from '../../shared/model/presentation';
import { tripDetailStyles as s } from '../styles/tripDetailStyles';

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  food: '식비',
  transport: '교통',
  stay: '숙박',
  activity: '관광·액티비티',
  shopping: '쇼핑',
  etc: '기타',
};

// 실제 지출과 예상 비용, 분류별 지출 현황을 가계부 대시보드로 표시한다.
export function TripCostSummary({
  expenses,
  selectedCategory = 'all',
  onSelectCategory,
}: {
  expenses: WorkspaceExpense[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}) {
  useLocale();
  // 조회에 있는 금액만 계산하며 환율이나 가짜 예산을 추가하지 않는다.
  const [showEstimates, setShowEstimates] = useState(false);
  const actualCosts = diaryCosts(expenses);
  const estimatedCosts = diaryCosts(expenses, false);
  const actualCount = expenses.filter((item) => item.isActual).length;
  const categoryCounts = Object.keys(EXPENSE_CATEGORY_LABELS).map((key) => ({
    key,
    label: EXPENSE_CATEGORY_LABELS[key] || '기타',
    count: expenses.filter((item) => (item.category || 'etc') === key).length,
  }));

  return (
    <View style={s.summary} testID="trip-expense-dashboard">
      <View style={[s.card, s.actual]}>
        <View style={s.heading}>
          <Text style={s.cardTitle}>{t('여행 내 사용한 금액')}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {t('실제 지출 {p0}건', { p0: actualCount })}
            </Text>
          </View>
        </View>
        {!actualCosts.length && (
          <Text style={s.meta}>{t('아직 기록한 지출이 없어요.')}</Text>
        )}
        {actualCosts.map((cost) => (
          <View key={cost.currency} style={s.currencyRow}>
            <Text style={s.meta}>{cost.currency}</Text>
            <Text style={s.total}>{cost.amount}</Text>
          </View>
        ))}
      </View>

      {onSelectCategory ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          testID="expense-category-filters"
        >
          <Action
            label={`${t('전체')} (${expenses.length})`}
            size="chip"
            selected={selectedCategory === 'all'}
            onPress={() => {
              trackWorkspaceEvent('expense_category_filter_click', {
                category: 'all',
              });
              onSelectCategory('all');
            }}
          />
          {categoryCounts.map((cat) => (
            <Action
              key={cat.key}
              label={
                cat.count > 0 ? `${t(cat.label)} (${cat.count})` : t(cat.label)
              }
              size="chip"
              selected={selectedCategory === cat.key}
              onPress={() => {
                trackWorkspaceEvent('expense_category_filter_click', {
                  category: cat.key,
                });
                onSelectCategory(cat.key);
              }}
            />
          ))}
        </View>
      ) : null}

      {estimatedCosts.length > 0 && (
        <Action
          label={showEstimates ? t('예상 비용 접기') : t('예상 비용 보기')}
          onPress={() => {
            // 실제 지출을 먼저 읽고 필요한 경우에만 예상 비용을 펼친다.
            return setShowEstimates(!showEstimates);
          }}
        />
      )}
      {showEstimates && estimatedCosts.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('예상 비용')}</Text>
          {estimatedCosts.map((cost) => (
            <View key={cost.currency} style={s.currencyRow}>
              <Text style={s.meta}>{cost.currency}</Text>
              <Text style={s.total}>{cost.amount}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={s.meta}>
        {t('통화별로 모았어요. 서로 다른 통화는 합산하지 않아요.')}
      </Text>
    </View>
  );
}

// 비용 이름·분류·금액·기록 출처를 서로 다른 글자 역할로 표시한다.
export function TripExpenseHeading({
  item,
  scheduleTitle,
}: {
  item: WorkspaceExpense;
  scheduleTitle?: string;
}) {
  useLocale();
  const categoryLabel =
    EXPENSE_CATEGORY_LABELS[item.category || 'etc'] || '기타';
  // 영수증 비용과 직접 입력한 비용의 차이를 실제 출처로 안내한다.
  return (
    <View style={{ gap: 8 }}>
      <View style={s.heading}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {item.isActual ? t('실제 지출') : t('예상 비용')}
            </Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeText}>{t(categoryLabel)}</Text>
          </View>
        </View>
        <Text style={s.meta}>
          {item.source === 'manual' ? t('직접 기록') : t('영수증에서 기록')}
        </Text>
      </View>
      <Text style={s.cardTitle}>{item.title}</Text>
      <Text style={s.amount}>
        {item.currency} {item.amount}
      </Text>
      {scheduleTitle ? (
        <Text style={s.meta}>
          {t('연결한 일정 ·')} {scheduleTitle}
        </Text>
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
  useLocale();
  // 빈 목록을 준비 완료로 표시하지 않는다.
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{t('준비물')}</Text>
      <Text style={s.meta} accessibilityLiveRegion="polite">
        {
          items.filter((item) => {
            /* 저장된 완료 상태만 센다. */ return item.isCompleted;
          }).length
        }{' '}
        / {items.length}
        {t('개 준비했어요')}
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
  useLocale();
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
        <Text style={s.initial}>
          {[...member.nickname.trim()][0] || t('여')}
        </Text>
      </View>
      <View style={s.memberInfo}>
        <Text style={s.cardTitle}>
          {member.nickname}
          {member.isMe ? t(' (나)') : ''}
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
  useLocale();
  // 예시 데이터를 채우지 않고 현재 조회 결과만 설명한다.
  return (
    <HaruState kind="empty" title={title} description={description} compact />
  );
}
