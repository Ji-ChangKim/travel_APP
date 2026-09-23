import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { QuickAddModal } from '@/components/QuickAddModal';
import {
  calculateTripDays,
  useTripStore,
  type CalculatedDay,
} from '@/stores/useTripStore';
import type {
  Expense,
  ItineraryItem,
  PlaceCategory,
  ScheduleType,
} from '@wherego/domain';

// 장소 카테고리를 가계부 비용 카테고리로 매핑한다.
function mapPlaceCategoryToExpenseCategory(
  category: PlaceCategory,
): Expense['category'] {
  switch (category) {
    case 'food':
    case 'cafe':
      return 'food';
    case 'stay':
      return 'stay';
    case 'activity':
    case 'sightseeing':
      return 'activity';
    case 'etc':
    default:
      return 'etc';
  }
}

// 여행 상세 서브 탭 4종을 정의한다.
type SubTab = 'schedule' | 'map' | 'expense' | 'checklist';

// 일정 유형별 한국어 명칭과 아이콘, 색상 정보를 반환한다.
function getScheduleTypeBadge(type?: ScheduleType) {
  switch (type) {
    case 'TRANSPORT':
      return {
        label: '이동',
        icon: 'bus-outline' as const,
        color: colors.secondary,
        bg: colors.secondarySoft,
      };
    case 'STAY':
      return {
        label: '숙소',
        icon: 'bed-outline' as const,
        color: colors.tagPurpleText,
        bg: colors.tagPurple,
      };
    case 'RESERVATION':
      return {
        label: '예약',
        icon: 'ticket-outline' as const,
        color: colors.primary,
        bg: colors.primarySoft,
      };
    case 'MEMO':
      return {
        label: '메모',
        icon: 'document-text-outline' as const,
        color: colors.muted,
        bg: colors.borderLight,
      };
    case 'PLACE':
    default:
      return {
        label: '명소',
        icon: 'location-outline' as const,
        color: colors.primary,
        bg: colors.primarySoft,
      };
  }
}

// 여행 상세(Trip Detail) 일정 계획 및 공유 허브 화면을 렌더링한다.
export default function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // 전역 스토어 상태 및 조작 액션을 가져온다.
  const {
    trips,
    itineraries,
    expenses,
    checklists,
    members,
    addItineraryItem,
    deleteItineraryItem,
    addExpense,
    toggleChecklistItem,
    addChecklistItem,
    checkInPlace,
  } = useTripStore();

  // 대상 여행 정보를 찾는다.
  const trip = trips.find((t) => t.id === id);
  const tripId = trip?.id || '';

  // 현재 활성화된 서브 탭 상태를 관리한다.
  const [activeTab, setActiveTab] = useState<SubTab>('schedule');

  // 선택된 일차 번호를 관리한다 (기본 DAY 1).
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);

  // Quick Add 모달 노출 상태를 관리한다.
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // 준비물 추가 입력 상태를 관리한다.
  const [checklistInput, setChecklistInput] = useState('');

  // 비용 추가 모달 상태를 관리한다.
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<Expense['category']>('food');

  // 지도에서 선택된 장소 인덱스를 관리한다.
  const [selectedPlaceIndex, setSelectedPlaceIndex] = useState<number>(0);

  // 시작일과 종료일 문자열을 안전하게 추출한다.
  const startDate = trip?.startDate;
  const endDate = trip?.endDate;

  // 여행 기간에 따른 일차(DAY 1~N) 목록을 자동 계산한다.
  const tripDays = useMemo(() => {
    if (!startDate || !endDate) {
      return [
        {
          dayNumber: 1,
          dateString: '2026-10-01',
          dayLabel: 'DAY 1',
          weekday: '목',
        },
      ];
    }
    return calculateTripDays(startDate, endDate);
  }, [startDate, endDate]);

  // 현재 여행의 모든 일정을 가져온다.
  const currentItinerary = useMemo(() => {
    return itineraries[tripId] || [];
  }, [itineraries, tripId]);

  // 현재 선택된 일차(DAY)에 해당하는 일정만 필터링한다.
  const filteredSchedule = useMemo(() => {
    return currentItinerary.filter(
      (item) => item.tripDayId === `day-${selectedDayNumber}`,
    );
  }, [currentItinerary, selectedDayNumber]);

  // 현재 일차의 예상 비용 총합을 계산한다.
  const totalDayEstimatedCost = useMemo(() => {
    return filteredSchedule.reduce(
      (sum, item) => sum + (item.estimatedCost || 0),
      0,
    );
  }, [filteredSchedule]);

  // 현재 여행의 지출 목록을 가져온다.
  const currentExpenses = useMemo(() => {
    return expenses[tripId] || [];
  }, [expenses, tripId]);

  // 현재 여행의 체크리스트를 가져온다.
  const currentChecklist = useMemo(() => {
    return checklists[tripId] || [];
  }, [checklists, tripId]);

  // 현재 여행의 동행 멤버 수를 계산한다.
  const memberCount = useMemo(() => {
    return (members[tripId] || []).length || 1;
  }, [members, tripId]);

  // 여행 초대 코드를 모바일 공유 다이얼로그로 전송한다.
  const handleShareTrip = async () => {
    if (!trip) return;

    const inviteCode = trip.inviteCode || 'WHEREGO';
    const shareMessage = `[WHEREGO] '${trip.title}' 여행에 초대합니다!\n초대 코드: ${inviteCode}\n앱의 [내 여행 > 코드 참여]에서 코드를 입력하면 함께 일정을 계획할 수 있습니다.`;

    try {
      await Share.share({
        title: `${trip.title} 여행 초대`,
        message: shareMessage,
      });
    } catch {
      // 공유 취소 또는 오류 시 단순 안내를 제공한다.
      Alert.alert('초대 코드 안내', `초대 코드: ${inviteCode}`);
    }
  };

  // QuickAddModal에서 전달된 신규 일정을 등록한다.
  const handleAddScheduleFromModal = (scheduleData: {
    type: ScheduleType;
    title: string;
    timeSlot: string;
    estimatedCost: number;
    memo: string;
    placeCategory: PlaceCategory;
    transitInfo?: string;
  }) => {
    if (!tripId) return;

    // 스토어에 새 일정 아이템을 추가한다.
    addItineraryItem(tripId, {
      tripDayId: `day-${selectedDayNumber}`,
      placeId: `place-${Date.now()}`,
      type: scheduleData.type,
      title: scheduleData.title,
      timeSlot: scheduleData.timeSlot,
      sortOrder: filteredSchedule.length + 1,
      estimatedCost: scheduleData.estimatedCost,
      memo: scheduleData.memo,
      transitInfo: scheduleData.transitInfo,
      place: {
        id: `place-${Date.now()}`,
        name: scheduleData.title,
        latitude: 33.5 + (filteredSchedule.length + 1) * 0.05,
        longitude: 126.5 + (filteredSchedule.length + 1) * 0.05,
        category: scheduleData.placeCategory,
        createdAt: new Date().toISOString(),
      },
    });

    // 예상 비용이 등록되어 있다면 가계부에도 자동 연동한다.
    if (scheduleData.estimatedCost > 0) {
      addExpense(tripId, {
        tripDayId: `day-${selectedDayNumber}`,
        title: `${scheduleData.title} (예상)`,
        amount: scheduleData.estimatedCost,
        currency: 'KRW',
        category: mapPlaceCategoryToExpenseCategory(scheduleData.placeCategory),
        isActual: false,
      });
    }
  };

  // 일정을 삭제한다.
  const handleDeleteScheduleItem = (itemId: string, title?: string) => {
    Alert.alert(
      '일정 삭제',
      `'${title || '선택한 항목'}' 일정을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteItineraryItem(tripId, itemId),
        },
      ],
    );
  };

  // 장소 방문 체크인을 수행한다.
  const handleCheckInItem = (item: ItineraryItem) => {
    checkInPlace(tripId, item, 'manual');
    Alert.alert(
      '체크인 완료',
      `'${item.title || item.place?.name}' 장소에 방문 발자국을 남겼습니다!`,
    );
  };

  // 준비물 체크리스트를 등록한다.
  const handleAddChecklistSubmit = () => {
    if (!checklistInput.trim()) return;
    addChecklistItem(tripId, checklistInput.trim());
    setChecklistInput('');
  };

  // 새로운 가계부 항목을 등록한다.
  const handleAddExpenseSubmit = () => {
    if (!expTitle.trim() || !expAmount.trim()) {
      Alert.alert('알림', '항목명과 금액을 모두 입력해 주세요.');
      return;
    }

    const amountNum = Number(expAmount.replace(/,/g, ''));
    addExpense(tripId, {
      tripDayId: `day-${selectedDayNumber}`,
      title: expTitle.trim(),
      amount: isNaN(amountNum) ? 0 : amountNum,
      currency: 'KRW',
      category: expCategory,
      isActual: true,
    });

    setIsExpenseModalOpen(false);
    setExpTitle('');
    setExpAmount('');
  };

  // 여행 데이터가 없을 때 안전하게 뒤로가기를 제공한다.
  if (!trip) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>여행 정보를 찾을 수 없습니다.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.backButtonText}>여행 목록으로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* 상단 앱바 네비게이션 */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.navBackText}>Trips Home</Text>
        </TouchableOpacity>

        {/* 공유 버튼 */}
        <TouchableOpacity
          style={styles.navShareBtn}
          onPress={handleShareTrip}
          activeOpacity={0.8}
        >
          <Ionicons
            name="share-social-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.navShareText}>공유</Text>
        </TouchableOpacity>
      </View>

      {/* 4대 서브 탭 바 (시안 디자인: 라운드 캡슐 필 스타일) */}
      <View style={styles.subTabBar}>
        {(
          [
            { key: 'schedule', label: '일정' },
            { key: 'map', label: '지도' },
            { key: 'expense', label: '비용' },
            { key: 'checklist', label: '준비' },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.subTabItem, isActive && styles.subTabItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.subTabLabel,
                  isActive && styles.subTabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 여행 배너 카드 */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerBadgeRow}>
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>
                {trip.startDate} ~ {trip.endDate}
              </Text>
            </View>
            <View style={styles.inviteCodeBadge}>
              <Text style={styles.inviteCodeBadgeText}>
                코드: {trip.inviteCode || 'WG'}
              </Text>
            </View>
          </View>

          <Text style={styles.bannerTitle}>{trip.title}</Text>
          <Text style={styles.bannerLocation}>
            📍 {trip.country} · {trip.city}
          </Text>

          {/* 동행 멤버 및 공유 CTA */}
          <View style={styles.bannerMemberRow}>
            <View style={styles.memberAvatarGroup}>
              <View style={[styles.avatarCircle, { zIndex: 3 }]}>
                <Ionicons name="person" size={14} color={colors.primary} />
              </View>
              <View
                style={[
                  styles.avatarCircle,
                  { marginLeft: -8, zIndex: 2, backgroundColor: colors.border },
                ]}
              >
                <Ionicons name="people" size={14} color={colors.muted} />
              </View>
              <Text style={styles.memberText}>
                동행 멤버 {memberCount}명 참여 중
              </Text>
            </View>

            <TouchableOpacity
              style={styles.inviteSmallBtn}
              onPress={handleShareTrip}
            >
              <Ionicons name="person-add" size={12} color={colors.primary} />
              <Text style={styles.inviteSmallBtnText}>+ 동행 초대</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. 일정 탭 (Schedule Tab) */}
        {activeTab === 'schedule' && (
          <View style={styles.tabContent}>
            {/* 일정 브라우징 Day 가로 슬라이더 */}
            <View style={styles.daySectionHeader}>
              <Text style={styles.daySectionTitle}>
                일정 브라우징 · DAY {selectedDayNumber} of {tripDays.length}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.daySliderScroll}
              contentContainerStyle={styles.daySliderContent}
            >
              {tripDays.map((day: CalculatedDay) => {
                const isSelected = selectedDayNumber === day.dayNumber;
                return (
                  <TouchableOpacity
                    key={day.dayNumber}
                    style={[
                      styles.daySliderCard,
                      isSelected && styles.daySliderCardActive,
                    ]}
                    onPress={() => setSelectedDayNumber(day.dayNumber)}
                  >
                    <Text
                      style={[
                        styles.dayCardLabel,
                        isSelected && styles.dayCardLabelActive,
                      ]}
                    >
                      {day.dayLabel}
                    </Text>
                    <Text
                      style={[
                        styles.dayCardDate,
                        isSelected && styles.dayCardDateActive,
                      ]}
                    >
                      {day.dateString.slice(5)} ({day.weekday})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 데일리 요약 바 (Daily Stat Bar) */}
            <View style={styles.dailyStatBar}>
              <Text style={styles.dailyStatText}>
                방문 예정{' '}
                <Text style={styles.statHighlight}>
                  {filteredSchedule.length}곳
                </Text>
              </Text>
              <Text style={styles.statDivider}>|</Text>
              <Text style={styles.dailyStatText}>
                예상 경비{' '}
                <Text style={styles.statHighlight}>
                  ₩{totalDayEstimatedCost.toLocaleString()}
                </Text>
              </Text>
            </View>

            {/* 타임라인 목록 영역 */}
            {filteredSchedule.length === 0 ? (
              // 빈 일정 상태 (Empty State)
              <View style={styles.scheduleEmptyWrap}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={40}
                  color={colors.mutedLight}
                />
                <Text style={styles.scheduleEmptyTitle}>
                  DAY {selectedDayNumber}에 등록된 일정이 없습니다
                </Text>
                <Text style={styles.scheduleEmptySub}>
                  아래 [+ 일정추가] 버튼을 눌러 방문 장소나 이동 일정을 등록해
                  보세요!
                </Text>
                <TouchableOpacity
                  style={styles.scheduleEmptyBtn}
                  onPress={() => setIsQuickAddOpen(true)}
                >
                  <Text style={styles.scheduleEmptyBtnText}>
                    + 첫 일정 등록하기
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              // 타임라인 아이템 목록
              <View style={styles.timelineList}>
                {filteredSchedule.map((item, index) => {
                  const typeBadge = getScheduleTypeBadge(item.type);

                  return (
                    <View key={item.id} style={styles.timelineNodeWrap}>
                      {/* 타임라인 카드 */}
                      <View style={styles.timelineCard}>
                        {/* 상단 시간 및 유형 배지 */}
                        <View style={styles.itemHeaderRow}>
                          <View style={styles.itemTimeRow}>
                            <Text style={styles.itemTime}>
                              {item.timeSlot || '12:00'}
                            </Text>
                            <View
                              style={[
                                styles.itemTypeBadge,
                                { backgroundColor: typeBadge.bg },
                              ]}
                            >
                              <Ionicons
                                name={typeBadge.icon}
                                size={12}
                                color={typeBadge.color}
                              />
                              <Text
                                style={[
                                  styles.itemTypeBadgeText,
                                  { color: typeBadge.color },
                                ]}
                              >
                                {typeBadge.label}
                              </Text>
                            </View>
                          </View>

                          {/* 삭제 버튼 */}
                          <TouchableOpacity
                            style={styles.itemDeleteBtn}
                            onPress={() =>
                              handleDeleteScheduleItem(item.id, item.title)
                            }
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={colors.mutedLight}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* 일정 제목 */}
                        <Text style={styles.itemTitle}>{item.title}</Text>

                        {/* 메모 */}
                        {item.memo ? (
                          <Text style={styles.itemMemo}>{item.memo}</Text>
                        ) : null}

                        {/* 비용 표시 및 체크인 액션 바 */}
                        <View style={styles.itemFooterRow}>
                          <Text style={styles.itemCostText}>
                            {item.estimatedCost && item.estimatedCost > 0
                              ? `예상 ₩${item.estimatedCost.toLocaleString()}`
                              : '비용 없음'}
                          </Text>

                          <TouchableOpacity
                            style={styles.checkInBtn}
                            onPress={() => handleCheckInItem(item)}
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={14}
                              color={colors.primary}
                            />
                            <Text style={styles.checkInBtnText}>방문 인증</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* 인라인 이동 안내 카드 (Transit Info) */}
                      {item.transitInfo ? (
                        <View style={styles.transitInfoCard}>
                          <Ionicons
                            name="navigate-circle-outline"
                            size={16}
                            color={colors.secondary}
                          />
                          <Text style={styles.transitInfoText}>
                            {item.transitInfo}
                          </Text>
                        </View>
                      ) : index < filteredSchedule.length - 1 ? (
                        <View style={styles.timelineConnectLine} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* 2. 지도 탭 (Map Tab) */}
        {activeTab === 'map' && (
          <View style={styles.tabContent}>
            {/* 동선 통계 바 */}
            <View style={styles.mapStatBar}>
              <Text style={styles.mapStatText}>
                총 {filteredSchedule.length}개 지점 동선 순서 (1 →{' '}
                {filteredSchedule.length})
              </Text>
            </View>

            {/* 지도 및 경로 시각화 영역 */}
            <View style={styles.mapCanvas}>
              {filteredSchedule.length === 0 ? (
                <View style={styles.mapEmptyWrap}>
                  <Ionicons
                    name="map-outline"
                    size={36}
                    color={colors.mutedLight}
                  />
                  <Text style={styles.mapEmptyText}>
                    DAY {selectedDayNumber}에 등록된 장소가 없습니다.
                  </Text>
                </View>
              ) : (
                <View style={styles.mapPinList}>
                  {filteredSchedule.map((item, idx) => {
                    const isSelected = selectedPlaceIndex === idx;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.mapPinItem,
                          isSelected && styles.mapPinItemActive,
                        ]}
                        onPress={() => setSelectedPlaceIndex(idx)}
                      >
                        <View
                          style={[
                            styles.pinNumber,
                            isSelected && styles.pinNumberActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.pinNumberText,
                              isSelected && styles.pinNumberTextActive,
                            ]}
                          >
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={styles.pinDetails}>
                          <Text
                            style={[
                              styles.pinTitle,
                              isSelected && styles.pinTitleActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text style={styles.pinTime}>
                            {item.timeSlot || '12:00'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 선택된 장소 플로팅 정보 카드 */}
            {filteredSchedule[selectedPlaceIndex] ? (
              <View style={styles.floatingPlaceCard}>
                <View style={styles.floatingCardHeader}>
                  <View style={styles.floatingTitleRow}>
                    <View style={styles.floatingNumberBadge}>
                      <Text style={styles.floatingNumberText}>
                        {selectedPlaceIndex + 1}
                      </Text>
                    </View>
                    <Text style={styles.floatingTitle}>
                      {filteredSchedule[selectedPlaceIndex]?.title}
                    </Text>
                  </View>
                  <Text style={styles.floatingTime}>
                    {filteredSchedule[selectedPlaceIndex]?.timeSlot}
                  </Text>
                </View>

                {filteredSchedule[selectedPlaceIndex]?.memo ? (
                  <Text style={styles.floatingMemo}>
                    {filteredSchedule[selectedPlaceIndex]?.memo}
                  </Text>
                ) : null}

                <View style={styles.floatingActionRow}>
                  <TouchableOpacity
                    style={styles.floatingCheckInBtn}
                    onPress={() =>
                      handleCheckInItem(filteredSchedule[selectedPlaceIndex]!)
                    }
                  >
                    <Ionicons
                      name="footsteps-outline"
                      size={14}
                      color={colors.textLight}
                    />
                    <Text style={styles.floatingCheckInBtnText}>방문 인증</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* 3. 비용 탭 (Expense Tab) */}
        {activeTab === 'expense' && (
          <View style={styles.tabContent}>
            <View style={styles.expenseHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>여행 가계부</Text>
              <TouchableOpacity
                style={styles.addExpenseSmallBtn}
                onPress={() => setIsExpenseModalOpen(true)}
              >
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addExpenseSmallBtnText}>지출 추가</Text>
              </TouchableOpacity>
            </View>

            {currentExpenses.length === 0 ? (
              <View style={styles.scheduleEmptyWrap}>
                <Ionicons
                  name="wallet-outline"
                  size={36}
                  color={colors.mutedLight}
                />
                <Text style={styles.scheduleEmptyTitle}>
                  등록된 지출 내역이 없습니다
                </Text>
                <Text style={styles.scheduleEmptySub}>
                  일정을 추가할 때 예상 경비를 입력하거나, 지출 추가를 통해
                  가계부를 관리해 보세요.
                </Text>
              </View>
            ) : (
              <View style={styles.expenseList}>
                {currentExpenses.map((exp) => (
                  <View key={exp.id} style={styles.expenseItem}>
                    <View style={styles.expenseItemLeft}>
                      <Text style={styles.expenseItemTitle}>{exp.title}</Text>
                      <Text style={styles.expenseItemCategory}>
                        {exp.category} ·{' '}
                        {exp.isActual ? '실제 지출' : '예상 비용'}
                      </Text>
                    </View>
                    <Text style={styles.expenseItemAmount}>
                      ₩{exp.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 4. 준비물 탭 (Checklist Tab) */}
        {activeTab === 'checklist' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeaderTitle}>
              여행 준비물 체크리스트
            </Text>

            {/* 준비물 추가 인풋 */}
            <View style={styles.checklistInputRow}>
              <TextInput
                style={styles.checklistInput}
                placeholder="준비할 물품을 입력하세요 (예: 여권, 충전기)"
                placeholderTextColor={colors.mutedLight}
                value={checklistInput}
                onChangeText={setChecklistInput}
              />
              <TouchableOpacity
                style={styles.checklistAddBtn}
                onPress={handleAddChecklistSubmit}
              >
                <Text style={styles.checklistAddBtnText}>추가</Text>
              </TouchableOpacity>
            </View>

            {/* 체크리스트 목록 */}
            {currentChecklist.length === 0 ? (
              <View style={styles.scheduleEmptyWrap}>
                <Ionicons
                  name="checkmark-done-outline"
                  size={36}
                  color={colors.mutedLight}
                />
                <Text style={styles.scheduleEmptyTitle}>
                  등록된 준비물이 없습니다
                </Text>
                <Text style={styles.scheduleEmptySub}>
                  여행 전 챙겨야 할 물품을 체크리스트에 기록해 두세요.
                </Text>
              </View>
            ) : (
              <View style={styles.checklistContainer}>
                {currentChecklist.map((chk) => (
                  <TouchableOpacity
                    key={chk.id}
                    style={styles.checkItemRow}
                    onPress={() => toggleChecklistItem(tripId, chk.id)}
                  >
                    <Ionicons
                      name={chk.isCompleted ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={
                        chk.isCompleted ? colors.primary : colors.mutedLight
                      }
                    />
                    <Text
                      style={[
                        styles.checkItemTitle,
                        chk.isCompleted && styles.checkItemTitleDone,
                      ]}
                    >
                      {chk.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 하단 고정 액션 바 (+ 일정추가 Primary 버튼) */}
      <View style={styles.bottomFixedBar}>
        <TouchableOpacity
          style={styles.addScheduleMainBtn}
          onPress={() => setIsQuickAddOpen(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={20} color={colors.textLight} />
          <Text style={styles.addScheduleMainBtnText}>+ 일정추가</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Add 모달 (시안 2/5 기반) */}
      <QuickAddModal
        visible={isQuickAddOpen}
        dayNumber={selectedDayNumber}
        tripTitle={trip.title}
        onClose={() => setIsQuickAddOpen(false)}
        onAddSchedule={handleAddScheduleFromModal}
      />

      {/* 비용 추가 간이 모달 */}
      <Modal
        visible={isExpenseModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsExpenseModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSmallCard}>
            <Text style={styles.modalSmallTitle}>새 지출 추가</Text>
            <TextInput
              style={styles.modalTextInput}
              placeholder="항목명 (예: 식당 결제, 기차표)"
              placeholderTextColor={colors.mutedLight}
              value={expTitle}
              onChangeText={setExpTitle}
            />
            <TextInput
              style={styles.modalTextInput}
              placeholder="금액 (원 단위)"
              keyboardType="numeric"
              placeholderTextColor={colors.mutedLight}
              value={expAmount}
              onChangeText={setExpAmount}
            />
            {/* 카테고리 선택 칩 */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                marginVertical: 4,
              }}
            >
              {(
                [
                  { key: 'food', label: '식비' },
                  { key: 'transport', label: '교통' },
                  { key: 'stay', label: '숙박' },
                  { key: 'activity', label: '관광' },
                  { key: 'shopping', label: '쇼핑' },
                  { key: 'etc', label: '기타' },
                ] as const
              ).map((cat) => {
                const isCatActive = expCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: isCatActive
                        ? colors.primary
                        : colors.background,
                      borderWidth: 1,
                      borderColor: isCatActive ? colors.primary : colors.border,
                    }}
                    onPress={() => setExpCategory(cat.key)}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: isCatActive ? colors.textLight : colors.muted,
                      }}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsExpenseModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleAddExpenseSubmit}
              >
                <Text style={styles.modalConfirmBtnText}>등록</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 화면 스타일을 정의한다.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.muted,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    color: colors.textLight,
    fontWeight: '700',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBackText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  navShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navShareText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  subTabItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  subTabItemActive: {
    backgroundColor: colors.text,
  },
  subTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  subTabLabelActive: {
    color: colors.textLight,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 90,
  },
  bannerCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerBadge: {
    backgroundColor: colors.secondarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bannerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
  },
  inviteCodeBadge: {
    backgroundColor: colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inviteCodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  bannerLocation: {
    fontSize: 13,
    color: colors.muted,
  },
  bannerMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 4,
  },
  memberAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  memberText: {
    fontSize: 12,
    color: colors.muted,
    marginLeft: 8,
  },
  inviteSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inviteSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  tabContent: {
    gap: 12,
  },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  daySliderScroll: {
    marginHorizontal: -20,
  },
  daySliderContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  daySliderCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 84,
  },
  daySliderCardActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dayCardLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  dayCardLabelActive: {
    color: colors.textLight,
  },
  dayCardDate: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  dayCardDateActive: {
    color: colors.mutedLight,
  },
  dailyStatBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  dailyStatText: {
    fontSize: 13,
    color: colors.muted,
  },
  statHighlight: {
    fontWeight: '700',
    color: colors.primary,
  },
  statDivider: {
    color: colors.border,
  },
  scheduleEmptyWrap: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  scheduleEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  scheduleEmptySub: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  scheduleEmptyBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  scheduleEmptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  timelineList: {
    gap: 10,
  },
  timelineNodeWrap: {
    gap: 6,
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  itemTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemDeleteBtn: {
    padding: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  itemMemo: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  itemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  itemCostText: {
    fontSize: 12,
    color: colors.muted,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  checkInBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  transitInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    alignSelf: 'flex-start',
    marginLeft: 14,
  },
  transitInfoText: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
  },
  timelineConnectLine: {
    width: 2,
    height: 12,
    backgroundColor: colors.border,
    marginLeft: 24,
  },
  mapStatBar: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapStatText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  mapCanvas: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 180,
  },
  mapEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  mapEmptyText: {
    fontSize: 13,
    color: colors.muted,
  },
  mapPinList: {
    gap: 8,
  },
  mapPinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    gap: 10,
  },
  mapPinItemActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pinNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinNumberActive: {
    backgroundColor: colors.primary,
  },
  pinNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  pinNumberTextActive: {
    color: colors.textLight,
  },
  pinDetails: {
    flex: 1,
  },
  pinTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pinTitleActive: {
    color: colors.primary,
  },
  pinTime: {
    fontSize: 11,
    color: colors.muted,
  },
  floatingPlaceCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  floatingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textLight,
  },
  floatingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  floatingTime: {
    fontSize: 12,
    color: colors.muted,
  },
  floatingMemo: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
  },
  floatingActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  floatingCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  floatingCheckInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
  },
  expenseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  addExpenseSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addExpenseSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  expenseList: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  expenseItemLeft: {
    gap: 2,
  },
  expenseItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  expenseItemCategory: {
    fontSize: 11,
    color: colors.muted,
  },
  expenseItemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  checklistInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  checklistInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  checklistAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  checklistAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLight,
  },
  checklistContainer: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  checkItemTitle: {
    fontSize: 14,
    color: colors.text,
  },
  checkItemTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.mutedLight,
  },
  bottomFixedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  addScheduleMainBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addScheduleMainBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSmallCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  modalSmallTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalTextInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelBtnText: {
    fontSize: 13,
    color: colors.muted,
  },
  modalConfirmBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLight,
  },
});
