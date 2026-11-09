import { useState, type Dispatch, type SetStateAction } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type {
  WorkspaceDay,
  WorkspaceExpense,
  WorkspaceSchedule,
  WorkspaceSnapshot,
} from '@wherego/domain';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import Text from '@/components/ui/AppText';
import AppModal from '@/components/ui/AppModal';
import ActionSheet from '@/components/ui/ActionSheet';
import DesignButton from '@/components/ui/DesignButton';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import TripIcon from '@/components/icons/TripIcon';
import { triggerHaptic } from '@/components/ui/haptics';
import { colors } from '@/constants/theme';
import { TripDayStrip } from '../../schedule/manager/TripTimeline';
import { schedulePageStyles as s } from '../../schedule/styles/schedulePageStyles';
import {
  formatLocalCurrency,
  resolveExpensePaymentMethod,
  resolveExpenseSplitType,
  setExpensePaymentMeta,
} from '../../my-trips/model/expensePaymentMeta';
import { workspaceDaySelection } from '../model/workspaceDaySelection';
import type { WorkspaceDraftKind } from '../model/workspaceDrafts';
import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  food: '식비',
  transport: '교통',
  stay: '숙박',
  activity: '관광·액티비티',
  shopping: '쇼핑',
  etc: '기타',
};

function formatDayShortDate(tripDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tripDate.trim());
  if (!match) return tripDate;
  return `${match[2]}. ${match[3]}`;
}

type RenderWorkspaceExpensesProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  selectedDay?: string;
  setSelectedDay?: Dispatch<SetStateAction<string>>;
  writable: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  openDraft?: (kind: WorkspaceDraftKind, schedule?: WorkspaceSchedule) => void;
  setShowReceiptCapture?: Dispatch<SetStateAction<boolean>>;
  photo?: (
    purpose: 'photo' | 'receipt',
    camera?: boolean,
    scheduleId?: string,
  ) => void;
  actions: WorkspaceScreenActions;
};

// 04_4_가계부_DAY타임라인: 시간·환율을 배제하고 현지 통화·Card/Cash 구분·일정 상세 연동을 표시한다.
function WorkspaceExpensesContent({
  snapshot,
  selectedDay = 'all',
  setSelectedDay,
  writable,
  busy,
  scanning,
  hasPending,
  openDraft,
  setShowReceiptCapture,
  photo,
  actions,
}: Omit<RenderWorkspaceExpensesProps, 'activeSection'>) {
  useLocale();
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team');
  const [showCategoryStats, setShowCategoryStats] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CARD' | 'CASH'>(
    'ALL',
  );
  const [, setMetaVersion] = useState(0);
  const [menuExpenseId, setMenuExpenseId] = useState('');
  const [detailScheduleId, setDetailScheduleId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);

  const daySelection = workspaceDaySelection(
    snapshot.days,
    selectedDay || 'all',
    true,
  );
  const memberCount = Math.max(1, snapshot.members.length);
  const primaryCurrency =
    snapshot.expenses.find((item) => item.isActual)?.currency ||
    snapshot.trip.defaultCurrency ||
    'KRW';

  // 실제 지출과 예상 예산을 분리해 현지 통화 기준으로만 집계한다 (환율 변환 없음).
  const actualExpenses = snapshot.expenses.filter((item) => item.isActual);
  const plannedExpenses = snapshot.expenses.filter((item) => !item.isActual);

  const filteredExpenses = actualExpenses.filter((item) => {
    const matchCategory =
      selectedCategory === 'all' ||
      (item.category || 'etc') === selectedCategory;
    const method = resolveExpensePaymentMethod(item);
    const matchPayment = paymentFilter === 'ALL' || method === paymentFilter;
    return matchCategory && matchPayment;
  });

  // 팀 전체 총액, 내 부담액, Card/Cash 합계를 계산한다.
  let teamTotal = 0;
  let personalTotal = 0;
  let cardTotal = 0;
  let cashTotal = 0;

  for (const item of actualExpenses) {
    if (item.currency !== primaryCurrency) continue;
    const amt = Number(item.amount || 0);
    if (!Number.isFinite(amt)) continue;
    teamTotal += amt;
    const method = resolveExpensePaymentMethod(item);
    if (method === 'CASH') {
      cashTotal += amt;
    } else {
      cardTotal += amt;
    }
    const split = resolveExpenseSplitType(item, memberCount);
    personalTotal += split === 'SHARED' ? amt / memberCount : amt;
  }

  const plannedTotal = plannedExpenses
    .filter((item) => item.currency === primaryCurrency)
    .reduce((sum, item) => sum + (Number(item.amount || 0) || 0), 0);

  const displayedTotal = viewMode === 'team' ? teamTotal : personalTotal;
  const perPersonAvg = memberCount > 0 ? teamTotal / memberCount : teamTotal;
  const remainingBudget =
    plannedTotal > 0 ? Math.max(0, plannedTotal - teamTotal) : 0;
  const progressRatio =
    plannedTotal > 0
      ? Math.min(100, Math.round((teamTotal / plannedTotal) * 1000) / 10)
      : teamTotal > 0
        ? Math.round((cardTotal / teamTotal) * 100)
        : 0;

  const categoryCounts = Object.keys(EXPENSE_CATEGORY_LABELS).map((key) => ({
    key,
    label: EXPENSE_CATEGORY_LABELS[key] || '기타',
    count: actualExpenses.filter((item) => (item.category || 'etc') === key)
      .length,
  }));

  // 지출 항목이 속한 DAY ID를 판별한다 (연결 일정의 DAY 우선, 없으면 첫 DAY).
  function resolveExpenseDayId(item: WorkspaceExpense): string {
    if (item.dayId && snapshot.days.some((d) => d.id === item.dayId)) {
      return item.dayId;
    }
    if (item.scheduleId) {
      const sched = snapshot.itinerary.find((s) => s.id === item.scheduleId);
      if (sched?.dayId) return sched.dayId;
    }
    return snapshot.days[0]?.id || '';
  }

  // 지출 카드와 연결된 일정(04_3_일정상세 대상)을 찾는다.
  function findLinkedSchedule(
    item: WorkspaceExpense,
    day: WorkspaceDay,
  ): WorkspaceSchedule | undefined {
    if (item.scheduleId) {
      const byId = snapshot.itinerary.find((s) => s.id === item.scheduleId);
      if (byId) return byId;
    }
    return snapshot.itinerary.find(
      (s) => s.dayId === day.id && s.title.trim() === item.title.trim(),
    );
  }

  const menuExpense = snapshot.expenses.find(
    (item) => item.id === menuExpenseId,
  );
  const detailSchedule = snapshot.itinerary.find(
    (item) => item.id === detailScheduleId,
  );
  const detailDay = detailSchedule
    ? snapshot.days.find((d) => d.id === detailSchedule.dayId)
    : undefined;

  const stepNumberByExpenseId = new Map<string, number>();
  let orderCounter = 0;
  for (const day of daySelection.visibleDays) {
    for (const item of filteredExpenses) {
      if (resolveExpenseDayId(item) === day.id) {
        orderCounter += 1;
        stepNumberByExpenseId.set(item.id, orderCounter);
      }
    }
  }

  return (
    <View testID="trip-expenses-panel" style={es.container}>
      {/* 1. DAY 필터 스트립 ([전체] | DAY 1 | DAY 2 ...) */}
      <TripDayStrip
        days={snapshot.days}
        allowAll
        counts={Object.fromEntries(
          snapshot.days.map((day) => [
            day.id,
            filteredExpenses.filter(
              (item) => resolveExpenseDayId(item) === day.id,
            ).length,
          ]),
        )}
        selected={daySelection.selected}
        onSelect={(dayId) => {
          triggerHaptic('light');
          setSelectedDay?.(dayId);
        }}
      />

      {/* 2. 상단 경비 요약 대시보드 (환율 없음 · 현지 통화 & Card/Cash 중심) */}
      <View style={es.dashboardCard} testID="trip-expense-dashboard">
        <View style={es.dashboardTopRow}>
          <View style={es.modeSwitchWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === 'team' }}
              onPress={() => setViewMode('team')}
              style={[
                es.modeSwitchPill,
                viewMode === 'team' && es.modeSwitchPillActive,
              ]}
            >
              <Text
                style={[
                  es.modeSwitchText,
                  viewMode === 'team' && es.modeSwitchTextActive,
                ]}
              >
                {t('총 경비 (팀 전체)')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === 'personal' }}
              onPress={() => setViewMode('personal')}
              style={[
                es.modeSwitchPill,
                viewMode === 'personal' && es.modeSwitchPillActive,
              ]}
            >
              <Text
                style={[
                  es.modeSwitchText,
                  viewMode === 'personal' && es.modeSwitchTextActive,
                ]}
              >
                {t('내 정산 몫 (개인)')}
              </Text>
            </Pressable>
          </View>
          <View style={es.currencyBadge}>
            <Text style={es.currencyBadgeText}>
              {`Card / Cash · ${primaryCurrency}`}
            </Text>
          </View>
        </View>

        <Text style={es.totalCaption}>
          {viewMode === 'team' ? t('전체 팀 총 지출') : t('내 정산 총 지출')}
        </Text>
        <View style={es.totalAmountRow}>
          <Text style={es.totalAmountText}>
            {formatLocalCurrency(displayedTotal, primaryCurrency)}
          </Text>
          <View style={es.methodSplitBadgeRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setPaymentFilter((prev) => (prev === 'CARD' ? 'ALL' : 'CARD'))
              }
              style={[
                es.methodBadge,
                es.cardBadge,
                paymentFilter === 'CARD' && es.methodBadgeSelected,
              ]}
            >
              <Text style={es.cardBadgeText}>
                {`💳 Card ${formatLocalCurrency(cardTotal, primaryCurrency)}`}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setPaymentFilter((prev) => (prev === 'CASH' ? 'ALL' : 'CASH'))
              }
              style={[
                es.methodBadge,
                es.cashBadge,
                paymentFilter === 'CASH' && es.methodBadgeSelected,
              ]}
            >
              <Text style={es.cashBadgeText}>
                {`💵 Cash ${formatLocalCurrency(cashTotal, primaryCurrency)}`}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 예산 대비 사용률 프로그레스 바 (또는 Card/Cash 비중 바) */}
        <View style={es.progressSection}>
          <View style={es.progressLabelRow}>
            <Text style={es.progressMetaText}>
              {plannedTotal > 0
                ? t('예상 예산 {p0} 대비', {
                    p0: formatLocalCurrency(plannedTotal, primaryCurrency),
                  })
                : `💳 Card ${progressRatio}% · 💵 Cash ${Math.max(0, 100 - progressRatio)}%`}
            </Text>
            <Text style={es.progressHighlightText}>
              {plannedTotal > 0
                ? t('{p0}% 사용', { p0: progressRatio })
                : t('실제 지출 {p0}건', { p0: actualExpenses.length })}
            </Text>
          </View>
          <View style={es.progressTrack}>
            <View
              style={[
                es.progressFill,
                { width: `${Math.min(100, Math.max(0, progressRatio))}%` },
              ]}
            />
          </View>
        </View>

        {/* 하단 2열 요약 박스 */}
        <View style={es.subSummaryBox}>
          <View style={es.subSummaryCol}>
            <Text style={es.subSummaryLabel}>{t('1인 평균 지출')}</Text>
            <Text style={es.subSummaryValue}>
              {formatLocalCurrency(perPersonAvg, primaryCurrency)}
            </Text>
          </View>
          <View style={es.subSummaryDivider} />
          <View style={[es.subSummaryCol, { alignItems: 'flex-end' }]}>
            <Text style={es.subSummaryLabel}>
              {plannedTotal > 0 ? t('남은 예산') : 'Cash / Card 건수'}
            </Text>
            <Text style={[es.subSummaryValue, es.subSummaryValueAccent]}>
              {plannedTotal > 0
                ? formatLocalCurrency(remainingBudget, primaryCurrency)
                : `Card ${
                    actualExpenses.filter(
                      (i) => resolveExpensePaymentMethod(i) === 'CARD',
                    ).length
                  } · Cash ${
                    actualExpenses.filter(
                      (i) => resolveExpensePaymentMethod(i) === 'CASH',
                    ).length
                  }`}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. 퀵 액션 2열 버튼 ([영수증 스캔] | [카테고리 통계]) */}
      <View style={es.quickActionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('영수증 스캔')}
          disabled={!writable || busy || scanning || hasPending}
          onPress={() => {
            if (setShowReceiptCapture) {
              setShowReceiptCapture(true);
            } else {
              openDraft?.('expense');
            }
          }}
          style={({ pressed }) => [es.quickActionBtn, pressed && s.pressed]}
        >
          <Ionicons
            name="receipt-outline"
            size={16}
            color={colors.primary}
            aria-hidden
          />
          <Text style={es.quickActionText}>{t('영수증 스캔')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('카테고리 통계')}
          onPress={() => setShowCategoryStats((prev) => !prev)}
          style={({ pressed }) => [
            es.quickActionBtn,
            showCategoryStats && es.quickActionBtnActive,
            pressed && s.pressed,
          ]}
        >
          <Ionicons
            name="pie-chart-outline"
            size={16}
            color={colors.primary}
            aria-hidden
          />
          <Text style={es.quickActionText}>{t('카테고리 통계')}</Text>
        </Pressable>
      </View>

      {/* 카테고리 및 결제수단 필터 칩 영역 */}
      <View style={es.categoryFilterRow} testID="expense-category-filters">
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSelectedCategory('all');
            setPaymentFilter('ALL');
          }}
          style={[
            es.filterChip,
            selectedCategory === 'all' &&
              paymentFilter === 'ALL' &&
              es.filterChipActive,
          ]}
        >
          <Text
            style={[
              es.filterChipText,
              selectedCategory === 'all' &&
                paymentFilter === 'ALL' &&
                es.filterChipTextActive,
            ]}
          >
            {`${t('전체')} (${actualExpenses.length})`}
          </Text>
        </Pressable>
        {(showCategoryStats
          ? categoryCounts
          : categoryCounts.filter((c) => c.count > 0)
        ).map((cat) => (
          <Pressable
            key={cat.key}
            accessibilityRole="button"
            onPress={() =>
              setSelectedCategory((prev) =>
                prev === cat.key ? 'all' : cat.key,
              )
            }
            style={[
              es.filterChip,
              selectedCategory === cat.key && es.filterChipActive,
            ]}
          >
            <Text
              style={[
                es.filterChipText,
                selectedCategory === cat.key && es.filterChipTextActive,
              ]}
            >
              {cat.count > 0 ? `${t(cat.label)} (${cat.count})` : t(cat.label)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 4. DAY별 지출 타임라인 */}
      {daySelection.visibleDays.map((day) => {
        const dayExpenses = filteredExpenses.filter(
          (item) => resolveExpenseDayId(item) === day.id,
        );
        const daySubtotal = dayExpenses
          .filter((item) => item.currency === primaryCurrency)
          .reduce((sum, item) => sum + (Number(item.amount || 0) || 0), 0);
        const shortDate = formatDayShortDate(day.tripDate);

        return (
          <View key={day.id} style={es.daySection}>
            <View style={s.headingRow}>
              <Text style={s.heading}>
                {shortDate
                  ? `DAY ${day.dayNumber} (${shortDate})`
                  : `DAY ${day.dayNumber}`}
              </Text>
              <Text style={es.daySubtotalText}>
                {dayExpenses.length > 0
                  ? `${t('{p0}개 지출', { p0: dayExpenses.length })} · ${formatLocalCurrency(daySubtotal, primaryCurrency)}`
                  : t('{p0}개 지출', { p0: 0 })}
              </Text>
            </View>

            {dayExpenses.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('DAY {p0} 등록된 지출 없음', {
                  p0: day.dayNumber,
                })}
                disabled={!writable || busy || scanning || hasPending}
                onPress={() => openDraft?.('expense')}
                style={({ pressed }) => [
                  es.emptyDayBox,
                  pressed && writable && s.pressed,
                ]}
              >
                <Ionicons
                  name="receipt-outline"
                  size={18}
                  color="#9E9689"
                  aria-hidden
                />
                <Text style={es.emptyDayText}>
                  {t('DAY {p0} 등록된 지출 없음', { p0: day.dayNumber })}
                </Text>
              </Pressable>
            ) : (
              <View style={es.dayExpenseList}>
                {dayExpenses.map((item, idx) => {
                  const stepNo = stepNumberByExpenseId.get(item.id) || idx + 1;
                  const paymentMethod = resolveExpensePaymentMethod(item);
                  const splitType = resolveExpenseSplitType(item, memberCount);
                  const linkedSchedule = findLinkedSchedule(item, day);
                  const numericAmount = Number(item.amount || 0) || 0;
                  const myShareAmount =
                    splitType === 'SHARED'
                      ? numericAmount / memberCount
                      : numericAmount;
                  const categoryLabel =
                    EXPENSE_CATEGORY_LABELS[item.category || 'etc'] || '기타';

                  return (
                    <View key={item.id} style={s.stop}>
                      {/* 좌측: 순번 원형 배지 (시간 텍스트 없음!) */}
                      <View style={s.rail} aria-hidden>
                        <View
                          style={[
                            s.marker,
                            s.placeMarker,
                            paymentMethod === 'CARD' && s.featuredMarker,
                          ]}
                        >
                          <Text
                            style={[
                              s.number,
                              paymentMethod === 'CARD' && s.featuredNumber,
                            ]}
                          >
                            {stepNo}
                          </Text>
                        </View>
                      </View>

                      {/* 우측: 지출 카드 (우측 썸네일 이미지 없음! 클릭 시 일정 상세 연결) */}
                      <Pressable
                        testID={`expense-card-${item.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={item.title}
                        onPress={() => {
                          triggerHaptic('selection');
                          if (linkedSchedule) {
                            setDetailScheduleId(linkedSchedule.id);
                          } else if (item.source === 'manual' && writable) {
                            actions.editExpense(item);
                          }
                        }}
                        style={({ pressed }) => [s.card, pressed && s.pressed]}
                      >
                        <View style={s.timelineHeaderRow}>
                          <View style={s.tagRow}>
                            <View style={s.categoryTagPill}>
                              <Text style={s.categoryTagText}>
                                {t(categoryLabel)}
                              </Text>
                            </View>
                            <View
                              style={[
                                es.methodTagPill,
                                paymentMethod === 'CARD'
                                  ? es.cardBadge
                                  : es.cashBadge,
                              ]}
                            >
                              <Text
                                style={
                                  paymentMethod === 'CARD'
                                    ? es.cardBadgeText
                                    : es.cashBadgeText
                                }
                              >
                                {paymentMethod === 'CARD'
                                  ? '💳 Card'
                                  : '💵 Cash'}
                              </Text>
                            </View>
                            <View style={s.reserveTagPill}>
                              <Text style={s.reserveTagText}>
                                {splitType === 'SHARED'
                                  ? t('공동 정산')
                                  : t('개인 지출')}
                              </Text>
                            </View>
                          </View>

                          <View style={s.timelineRightActions}>
                            <DesignButton
                              size="icon"
                              variant="quiet"
                              label=""
                              accessibilityLabel={t('비용 수정')}
                              disabled={busy || scanning || hasPending}
                              onPress={() => setMenuExpenseId(item.id)}
                              icon={(color) => (
                                <Ionicons
                                  name="ellipsis-vertical"
                                  size={16}
                                  color={color}
                                />
                              )}
                            />
                          </View>
                        </View>

                        <Text style={s.title} numberOfLines={2}>
                          {linkedSchedule?.title || item.title}
                        </Text>
                        {linkedSchedule?.memo || linkedSchedule?.address ? (
                          <Text style={es.expenseSubText} numberOfLines={1}>
                            {linkedSchedule.memo || linkedSchedule.address}
                          </Text>
                        ) : null}

                        {/* 하단 금액 & Cash/Card 정산 부담액 행 (환율/원화 환산 없음!) */}
                        <View style={es.amountFooterRow}>
                          <Text style={es.primaryExpenseAmount}>
                            {formatLocalCurrency(numericAmount, item.currency)}
                          </Text>
                          <View style={es.shareRightCol}>
                            <Text style={es.myShareText}>
                              {t('내 부담액 {p0}', {
                                p0: formatLocalCurrency(
                                  myShareAmount,
                                  item.currency,
                                ),
                              })}
                            </Text>
                            <Text style={es.paymentMethodSubText}>
                              {splitType === 'SHARED'
                                ? `${paymentMethod === 'CARD' ? 'Card' : 'Cash'} · ${t('{p0}인 1/N', { p0: memberCount })}`
                                : `${paymentMethod === 'CARD' ? 'Card' : 'Cash'} · ${t('개인 전액 부담')}`}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* 5. 하단 고정 [+ 지출 추가] 버튼 */}
      {writable && (
        <Pressable
          testID="trip-expense-add-cta"
          accessibilityRole="button"
          accessibilityLabel={t('지출 추가')}
          disabled={busy || scanning || hasPending}
          onPress={() => openDraft?.('expense')}
          style={({ pressed }) => [es.addExpenseCta, pressed && s.pressed]}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" aria-hidden />
          <Text style={es.addExpenseCtaText}>{t('지출 추가')}</Text>
        </Pressable>
      )}

      {/* 지출 항목 우측 상단 ⋮ 빠른 관리 시트 */}
      <ActionSheet
        visible={Boolean(menuExpense)}
        title={menuExpense?.title || t('가계부')}
        onClose={() => setMenuExpenseId('')}
      >
        {menuExpense && (
          <>
            <DesignButton
              label={
                resolveExpensePaymentMethod(menuExpense) === 'CARD'
                  ? `💵 ${t('현금 (Cash)')} 결제로 변경`
                  : `💳 ${t('카드 (Card)')} 결제로 변경`
              }
              onPress={() => {
                const next =
                  resolveExpensePaymentMethod(menuExpense) === 'CARD'
                    ? 'CASH'
                    : 'CARD';
                setExpensePaymentMeta(menuExpense.id, { paymentMethod: next });
                setMetaVersion((v) => v + 1);
                setMenuExpenseId('');
              }}
            />
            <DesignButton
              label={
                resolveExpenseSplitType(menuExpense, memberCount) === 'SHARED'
                  ? `${t('개인 지출')}로 변경`
                  : `${t('공동 정산')} (1/N)으로 변경`
              }
              onPress={() => {
                const next =
                  resolveExpenseSplitType(menuExpense, memberCount) === 'SHARED'
                    ? 'PERSONAL'
                    : 'SHARED';
                setExpensePaymentMeta(menuExpense.id, { splitType: next });
                setMetaVersion((v) => v + 1);
                setMenuExpenseId('');
              }}
            />
            {menuExpense.source === 'manual' && writable && (
              <>
                <DesignButton
                  label={t('비용 수정')}
                  disabled={busy || scanning || hasPending}
                  onPress={() => {
                    setMenuExpenseId('');
                    actions.editExpense(menuExpense);
                  }}
                />
                <DesignButton
                  label={t('비용 삭제')}
                  disabled={busy || scanning || hasPending}
                  onPress={() => {
                    setMenuExpenseId('');
                    actions.deleteExpense(menuExpense);
                  }}
                />
              </>
            )}
          </>
        )}
      </ActionSheet>

      {/* 지출 카드 클릭 시 열리는 04_3_일정상세 모달 (여행 계획 탭과 100% 동일 연동) */}
      <AppModal
        native
        visible={Boolean(detailSchedule)}
        accessibilityLabel={t('일정 상세')}
        onRequestClose={() => setDetailScheduleId('')}
      >
        {detailSchedule && (
          <SafeAreaView style={s.page}>
            <ScreenHeader
              title={t('일정 상세')}
              onBack={() => setDetailScheduleId('')}
            />
            <ScrollView contentContainerStyle={s.content}>
              {/* [i & ii] 일정 정보 + 구글 기반 위치 보기 */}
              <View style={s.detailSectionCard}>
                <View style={s.row}>
                  <View style={s.categoryTagPill}>
                    <Text style={s.categoryTagText}>
                      {`DAY ${detailDay?.dayNumber || 1}`}
                    </Text>
                  </View>
                  <Text style={s.inlineMetaText}>{t('일정 정보')}</Text>
                </View>
                <Text style={s.heading}>{detailSchedule.title}</Text>
                {detailSchedule.address ? (
                  <View style={s.addressRow}>
                    <TripIcon
                      name="map-pin-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={s.body}>{detailSchedule.address}</Text>
                  </View>
                ) : null}
                {detailSchedule.location ? (
                  <Text style={s.meta}>
                    {`${t('위치 보기')}: ${detailSchedule.location.latitude.toFixed(4)}, ${detailSchedule.location.longitude.toFixed(4)}`}
                  </Text>
                ) : null}
                {/* [iii] 길찾기 (구글 지도 이동) */}
                <DesignButton
                  label={t('구글 지도로 길찾기')}
                  variant="primary"
                  onPress={() => {
                    const dest = encodeURIComponent(
                      detailSchedule.location
                        ? `${detailSchedule.location.latitude},${detailSchedule.location.longitude}`
                        : detailSchedule.address || detailSchedule.title,
                    );
                    const placeParam = detailSchedule.googlePlaceId
                      ? `&destination_place_id=${encodeURIComponent(detailSchedule.googlePlaceId)}`
                      : '';
                    void Linking.openURL(
                      `https://www.google.com/maps/dir/?api=1&destination=${dest}${placeParam}`,
                    ).catch(() => undefined);
                  }}
                />
              </View>

              {/* [iv] 메모 */}
              <View style={s.detailSectionCard}>
                <Text style={s.detailSectionTitle}>{t('일정 메모')}</Text>
                <View style={s.memoBox}>
                  <Text style={s.body}>
                    {detailSchedule.memo || t('등록된 메모가 없어요.')}
                  </Text>
                </View>
                {writable && (
                  <DesignButton
                    label={t('일정 수정')}
                    disabled={busy || scanning || hasPending}
                    onPress={() => {
                      setDetailScheduleId('');
                      actions.editSchedule(detailSchedule);
                    }}
                  />
                )}
              </View>

              {/* [v] 지출금 */}
              <View style={s.detailSectionCard}>
                <Text style={s.detailSectionTitle}>{t('지출금')}</Text>
                {snapshot.expenses
                  .filter((exp) => exp.scheduleId === detailSchedule.id)
                  .map((exp) => {
                    const method = resolveExpensePaymentMethod(exp);
                    return (
                      <View key={exp.id} style={s.recordBadge}>
                        <TripIcon
                          name="receipt-scan-outline"
                          size={14}
                          color={colors.secondary}
                        />
                        <Text style={s.recordBadgeText}>
                          {`${method === 'CARD' ? '💳 Card' : '💵 Cash'} · ${formatLocalCurrency(exp.amount, exp.currency)}`}
                        </Text>
                      </View>
                    );
                  })}
                {writable && (
                  <DesignButton
                    label={t('사용 비용 기록')}
                    disabled={busy || scanning || hasPending}
                    onPress={() => {
                      setDetailScheduleId('');
                      openDraft?.('expense', detailSchedule);
                    }}
                  />
                )}
              </View>

              {/* [vi & vii] 후기 보기 & 후기 남기기 (아이디어 A) */}
              <View style={s.detailSectionCard}>
                <Text style={s.detailSectionTitle}>{t('후기 보기')}</Text>
                <View style={s.memoBox}>
                  <Text style={s.recordBadgeText}>{t('APP 내 자체 리뷰')}</Text>
                  <Text style={s.meta}>
                    {detailSchedule.planContent?.description?.trim()
                      ? `★ ${reviewRating}.0 · ${detailSchedule.planContent.description}`
                      : t(
                          '아직 등록된 자체 후기가 없어요. 첫 번째 후기와 사진을 남겨보세요!',
                        )}
                  </Text>
                </View>
                <DesignButton
                  label={t('구글 실제 후기·평점 보기')}
                  onPress={() => {
                    const query = encodeURIComponent(
                      detailSchedule.title || '장소',
                    );
                    const placeParam = detailSchedule.googlePlaceId
                      ? `&query_place_id=${encodeURIComponent(detailSchedule.googlePlaceId)}`
                      : '';
                    void Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${query}${placeParam}`,
                    ).catch(() => undefined);
                  }}
                />
              </View>

              {writable && (
                <View style={s.detailSectionCard}>
                  <Text style={s.detailSectionTitle}>{t('후기 남기기')}</Text>
                  <View style={s.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable
                        key={star}
                        accessibilityRole="button"
                        accessibilityLabel={`★ ${star}`}
                        onPress={() => setReviewRating(star)}
                        style={[
                          s.starBtn,
                          reviewRating >= star && s.starBtnActive,
                        ]}
                      >
                        <Text style={s.recordBadgeText}>
                          {reviewRating >= star ? '★' : '☆'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {photo && (
                    <DesignButton
                      label={t('찍은 사진 추가')}
                      disabled={busy || scanning || hasPending}
                      onPress={() => {
                        setDetailScheduleId('');
                        photo('photo', false, detailSchedule.id);
                      }}
                    />
                  )}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </AppModal>
    </View>
  );
}

const es = StyleSheet.create({
  container: {
    gap: 14,
    paddingBottom: 24,
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  dashboardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeSwitchWrap: {
    flexDirection: 'row',
    backgroundColor: '#F4F2EE',
    borderRadius: 999,
    padding: 3,
    gap: 4,
  },
  modeSwitchPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeSwitchPillActive: {
    backgroundColor: '#FFFFFF',
  },
  modeSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A746B',
  },
  modeSwitchTextActive: {
    color: '#22201E',
    fontWeight: '700',
  },
  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF0EC',
  },
  currencyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E8573F',
  },
  totalCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A746B',
  },
  totalAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  totalAmountText: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: '#181818',
  },
  methodSplitBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  methodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  methodBadgeSelected: {
    borderWidth: 1.5,
    borderColor: '#181818',
  },
  cardBadge: {
    backgroundColor: '#EAF2FF',
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  cashBadge: {
    backgroundColor: '#E8F7EE',
  },
  cashBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  progressSection: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A746B',
  },
  progressHighlightText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E8573F',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#EFECE6',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FF6B57',
  },
  subSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F7F4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  subSummaryCol: {
    flex: 1,
    gap: 3,
  },
  subSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E0D8',
    marginHorizontal: 12,
  },
  subSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A746B',
  },
  subSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E2430',
  },
  subSummaryValueAccent: {
    color: '#E8573F',
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  quickActionBtnActive: {
    borderColor: '#FF6B57',
    backgroundColor: '#FFF5F2',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2B2926',
  },
  categoryFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EFECE6',
  },
  filterChipActive: {
    backgroundColor: '#FF6B57',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C574F',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  daySection: {
    gap: 10,
  },
  daySubtotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2B2926',
  },
  emptyDayBox: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: '#F3F1EC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
  },
  emptyDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8C857B',
  },
  dayExpenseList: {
    gap: 10,
  },
  methodTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expenseSubText: {
    fontSize: 12,
    color: '#7A746B',
  },
  amountFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4F1EC',
  },
  primaryExpenseAmount: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#181818',
  },
  shareRightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  myShareText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E8573F',
  },
  paymentMethodSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A746B',
  },
  addExpenseCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FF6B57',
    marginTop: 8,
  },
  addExpenseCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// 가계부 탭이 활성화된 경우에만 가계부 타임라인을 렌더링한다.
export function renderWorkspaceExpenses({
  activeSection,
  ...props
}: RenderWorkspaceExpensesProps) {
  return activeSection === 'expenses' ? (
    <WorkspaceExpensesContent {...props} />
  ) : null;
}
