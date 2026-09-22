import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
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
import {
  calculateTripDays,
  useTripStore,
  type CalculatedDay,
} from '@/stores/useTripStore';
import type {
  ChecklistItem,
  Expense,
  ItineraryItem,
  TripMember,
  ScheduleType,
} from '@wherego/domain';

// 여행 상세 서브 탭 5종을 정의한다.
type SubTab = 'schedule' | 'map' | 'expense' | 'checklist' | 'members';

// 일정 유형별 한국어 명칭과 색상을 반환한다.
function getScheduleTypeInfo(type?: ScheduleType) {
  // 유형에 따른 라벨과 스타일 객체를 반환한다.
  switch (type) {
    case 'TRANSPORT':
      return {
        label: '이동/교통',
        icon: 'bus-outline' as const,
        color: colors.tagBlue,
      };
    case 'STAY':
      return {
        label: '숙소',
        icon: 'bed-outline' as const,
        color: colors.tagPurple,
      };
    case 'RESERVATION':
      return {
        label: '예약',
        icon: 'ticket-outline' as const,
        color: colors.tagOrange,
      };
    case 'MEMO':
      return {
        label: '메모/팁',
        icon: 'document-text-outline' as const,
        color: colors.muted,
      };
    case 'TODO':
      return {
        label: '할일',
        icon: 'checkbox-outline' as const,
        color: colors.accent,
      };
    case 'PLACE':
    default:
      return {
        label: '명소/식당',
        icon: 'location-outline' as const,
        color: colors.accent,
      };
  }
}

// 비용 카테고리별 한국어 명칭을 반환한다.
function getExpenseCategoryLabel(category: Expense['category']) {
  // 카테고리 매핑 문자열을 반환한다.
  switch (category) {
    case 'food':
      return '식비';
    case 'transport':
      return '교통';
    case 'stay':
      return '숙박';
    case 'activity':
      return '관광/체험';
    case 'shopping':
      return '쇼핑';
    case 'etc':
    default:
      return '기타';
  }
}

// 여행 상세(Trip Detail) 통합 허브 화면을 렌더링한다.
export default function TripDetailScreen() {
  // 라우터 및 여행 ID 파라미터를 추출한다.
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // 전역 여행 스토어 상태 및 액션을 구독한다.
  const {
    trips,
    itineraries,
    expenses,
    checklists,
    members,
    shareTokens,
    addItineraryItem,
    addExpense,
    toggleChecklistItem,
    addChecklistItem,
    generateShareToken,
    checkInPlace,
  } = useTripStore();

  // 대상 여행 정보를 찾는다.
  const trip = trips.find((t) => t.id === id) || trips[0];
  const tripId = trip?.id || '';

  // 현재 활성화된 서브 탭 상태를 관리한다.
  const [activeTab, setActiveTab] = useState<SubTab>('schedule');

  // 선택된 일차(DAY 1, DAY 2...) 번호를 관리한다.
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);

  // 일정 추가 모달 상태를 관리한다.
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ScheduleType>('PLACE');
  const [newTime, setNewTime] = useState('11:00');
  const [newCost, setNewCost] = useState('');
  const [newMemo, setNewMemo] = useState('');

  // 지출 등록 모달 상태를 관리한다.
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<Expense['category']>('food');
  const [expIsActual, setExpIsActual] = useState(true);

  // 준비물 간편 등록 인풋 상태를 관리한다.
  const [newChecklistText, setNewChecklistText] = useState('');

  // 시작일과 종료일 문자열을 추출한다.
  const startDate = trip?.startDate;
  const endDate = trip?.endDate;

  // 여행 기간에 따른 DAY 1~N 목록을 자동 계산한다.
  const tripDays = useMemo(() => {
    // 여행 시작일과 종료일이 없으면 기본 1일 배열을 반환한다.
    if (!startDate || !endDate) {
      return [
        {
          dayNumber: 1,
          dateString: '',
          dayLabel: 'DAY 1',
          weekday: '',
        },
      ];
    }
    // 시작일과 종료일을 바탕으로 일차 배열을 산출하여 반환한다.
    return calculateTripDays(startDate, endDate);
  }, [startDate, endDate]);

  // 현재 여행의 모든 일정 목록을 가져온다.
  const currentItinerary = useMemo(() => {
    // 여행 ID에 해당하는 일정 배열을 반환한다.
    return itineraries[tripId] || [];
  }, [itineraries, tripId]);

  // 선택된 일차에 해당하는 일정만 필터링한다.
  const filteredSchedule = useMemo(() => {
    // tripDayId가 현재 일차에 일치하는 일정을 필터링하여 반환한다.
    return currentItinerary.filter(
      (item) => item.tripDayId === `day-${selectedDayNumber}`,
    );
  }, [currentItinerary, selectedDayNumber]);

  // 현재 여행의 비용 목록을 가져온다.
  const currentExpenses = useMemo(() => {
    // 여행 ID에 해당하는 비용 배열을 반환한다.
    return expenses[tripId] || [];
  }, [expenses, tripId]);

  // 총 예상 비용과 총 실제 지출액을 합산한다.
  const expenseSummary = useMemo(() => {
    // 실제 지출과 예상 비용을 구분하여 합산 객체를 생성하고 반환한다.
    const actual = currentExpenses
      .filter((e: Expense) => e.isActual)
      .reduce((sum: number, item: Expense) => sum + item.amount, 0);

    const estimated = currentExpenses
      .filter((e: Expense) => !e.isActual)
      .reduce((sum: number, item: Expense) => sum + item.amount, 0);

    return { actual, estimated, total: actual + estimated };
  }, [currentExpenses]);

  // 현재 여행의 체크리스트 목록을 가져온다.
  const currentChecklist = useMemo(() => {
    // 여행 ID에 해당하는 체크리스트 배열을 반환한다.
    return checklists[tripId] || [];
  }, [checklists, tripId]);

  // 현재 여행의 멤버 목록을 가져온다.
  const currentMembers = useMemo(() => {
    // 여행 ID에 해당하는 멤버 배열을 반환한다.
    return members[tripId] || [];
  }, [members, tripId]);

  // 새로운 일정을 등록 처리한다.
  const handleAddSchedule = () => {
    // 제목 입력 여부를 검사한다.
    if (!newTitle.trim()) {
      Alert.alert('알림', '일정 제목을 입력해 주세요.');
      return;
    }

    // 예상 비용 숫자를 파싱한다.
    const parsedCost = newCost.trim() ? Number(newCost.replace(/,/g, '')) : 0;

    // 스토어에 새 일정 아이템을 추가한다.
    addItineraryItem(tripId, {
      tripDayId: `day-${selectedDayNumber}`,
      placeId: `place-${Date.now()}`,
      type: newType,
      title: newTitle.trim(),
      timeSlot: newTime.trim() || '12:00',
      sortOrder: filteredSchedule.length + 1,
      estimatedCost: parsedCost,
      memo: newMemo.trim(),
      place: {
        id: `place-${Date.now()}`,
        name: newTitle.trim(),
        latitude: 33.5 + Math.random() * 0.1,
        longitude: 126.5 + Math.random() * 0.2,
        category:
          newType === 'STAY'
            ? 'stay'
            : newType === 'TRANSPORT'
              ? 'activity'
              : 'sightseeing',
        createdAt: new Date().toISOString(),
      },
    });

    // 비용이 기재되어 있을 경우 가계부에도 예상 비용으로 동기화 등록한다.
    if (parsedCost > 0) {
      addExpense(tripId, {
        tripDayId: `day-${selectedDayNumber}`,
        title: `${newTitle.trim()} (예상)`,
        amount: parsedCost,
        currency: 'KRW',
        category:
          newType === 'STAY'
            ? 'stay'
            : newType === 'TRANSPORT'
              ? 'transport'
              : 'activity',
        isActual: false,
      });
    }

    // 모달을 닫고 인풋 필드를 초기화한다.
    setIsScheduleModalOpen(false);
    setNewTitle('');
    setNewCost('');
    setNewMemo('');
  };

  // 새로운 가계부 지출을 등록 처리한다.
  const handleAddExpense = () => {
    // 제목과 금액 유효성을 검사한다.
    if (!expTitle.trim() || !expAmount.trim()) {
      Alert.alert('알림', '항목명과 금액을 모두 입력해 주세요.');
      return;
    }

    // 지출 객체를 스토어에 등록한다.
    addExpense(tripId, {
      tripDayId: `day-${selectedDayNumber}`,
      title: expTitle.trim(),
      amount: Number(expAmount.replace(/,/g, '')),
      currency: 'KRW',
      category: expCategory,
      isActual: expIsActual,
    });

    // 모달을 닫고 인풋 필드를 초기화한다.
    setIsExpenseModalOpen(false);
    setExpTitle('');
    setExpAmount('');
  };

  // 새로운 준비물 항목을 추가한다.
  const handleAddChecklist = () => {
    // 입력된 텍스트가 없으면 반환한다.
    if (!newChecklistText.trim()) return;

    // 준비물 아이템을 추가한다.
    addChecklistItem(tripId, newChecklistText.trim());

    // 입력 필드를 초기화한다.
    setNewChecklistText('');
  };

  // 동행자 초대 링크를 생성하고 알림창으로 안내한다.
  const handleShareTrip = () => {
    // 초대 토큰을 생성하거나 가져온다.
    const token = shareTokens[tripId] || generateShareToken(tripId);
    // 초대 링크 URL 문자열을 구성한다.
    const inviteLink = `https://wherego.travel/join?token=${token}`;

    // 알림 모달을 통해 복사 및 초대 안내를 제공한다.
    Alert.alert(
      '동행 멤버 초대 링크',
      `아래 초대 코드로 친구를 초대할 수 있습니다:\n\n${inviteLink}\n\n동행자는 실시간으로 일정을 함께 확인하고 편집할 수 있습니다.`,
    );
  };

  // 장소 체크인을 수행하고 발자국 등록을 안내한다.
  const handleCheckIn = (item: ItineraryItem) => {
    // 방문 체크인을 실행한다.
    checkInPlace(tripId, item, 'gps');
    // 사용자에게 성공 피드백을 전달한다.
    Alert.alert(
      '체크인 완료',
      `'${item.title || item.place?.name}' 장소에 발자국을 남겼습니다!`,
    );
  };

  // 여행 데이터가 없을 때 안전하게 뒤로가기를 제공한다.
  if (!trip) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>여행을 찾을 수 없습니다.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>목록으로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* 상단 네비게이션 헤더 */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navIconBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {trip.title}
          </Text>
          <Text style={styles.navSubtitle}>
            📍 {trip.city} · {trip.startDate} ~ {trip.endDate}
          </Text>
        </View>
        <TouchableOpacity style={styles.navShareBtn} onPress={handleShareTrip}>
          <Ionicons name="share-social-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 5대 서브 탭 바 */}
      <View style={styles.tabBar}>
        {(
          [
            { key: 'schedule', label: '일정', icon: 'calendar-outline' },
            { key: 'map', label: '지도', icon: 'map-outline' },
            { key: 'expense', label: '가계부', icon: 'wallet-outline' },
            {
              key: 'checklist',
              label: '체크리스트',
              icon: 'checkmark-circle-outline',
            },
            { key: 'members', label: '멤버', icon: 'people-outline' },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={isActive ? colors.accent : colors.muted}
              />
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 서브 탭 컨텐츠 영역 */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 일정 탭 (Schedule) */}
        {activeTab === 'schedule' && (
          <View style={styles.tabContent}>
            {/* DAY 슬라이더 바 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayScroll}
            >
              {tripDays.map((day: CalculatedDay) => {
                const isSelected = selectedDayNumber === day.dayNumber;
                return (
                  <TouchableOpacity
                    key={day.dayNumber}
                    style={[styles.dayChip, isSelected && styles.dayChipActive]}
                    onPress={() => setSelectedDayNumber(day.dayNumber)}
                  >
                    <Text
                      style={[
                        styles.dayChipLabel,
                        isSelected && styles.dayChipLabelActive,
                      ]}
                    >
                      {day.dayLabel}
                    </Text>
                    {day.weekday ? (
                      <Text
                        style={[
                          styles.dayChipSub,
                          isSelected && styles.dayChipSubActive,
                        ]}
                      >
                        {day.dateString.slice(5)} ({day.weekday})
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 일차별 헤더 & 일정 추가 버튼 */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  DAY {selectedDayNumber} 타임라인
                </Text>
                <Text style={styles.sectionSubtitle}>
                  총 {filteredSchedule.length}개의 일정
                </Text>
              </View>
              <TouchableOpacity
                style={styles.actionPrimaryBtn}
                onPress={() => setIsScheduleModalOpen(true)}
              >
                <Ionicons name="add" size={16} color={colors.textLight} />
                <Text style={styles.actionPrimaryBtnText}>일정 등록</Text>
              </TouchableOpacity>
            </View>

            {/* 타임라인 일정 목록 */}
            {filteredSchedule.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={40}
                  color={colors.mutedLight}
                />
                <Text style={styles.emptyStateTitle}>
                  DAY {selectedDayNumber}에 등록된 일정이 없습니다.
                </Text>
                <Text style={styles.emptyStateSub}>
                  관광지, 숙소, 이동 경로를 추가해 보세요!
                </Text>
              </View>
            ) : (
              filteredSchedule.map((item, idx) => {
                const typeInfo = getScheduleTypeInfo(item.type);
                return (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineIndexCol}>
                      <View style={styles.timelineBadge}>
                        <Text style={styles.timelineBadgeText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.timelineVerticalLine} />
                    </View>
                    <View style={styles.scheduleCard}>
                      <View style={styles.cardHeaderRow}>
                        <View
                          style={[
                            styles.categoryBadge,
                            { backgroundColor: typeInfo.color + '22' },
                          ]}
                        >
                          <Ionicons
                            name={typeInfo.icon}
                            size={12}
                            color={typeInfo.color}
                          />
                          <Text
                            style={[
                              styles.categoryBadgeText,
                              { color: typeInfo.color },
                            ]}
                          >
                            {typeInfo.label}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.checkInChip}
                          onPress={() => handleCheckIn(item)}
                        >
                          <Ionicons
                            name="footsteps-outline"
                            size={13}
                            color={colors.accent}
                          />
                          <Text style={styles.checkInChipText}>체크인</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.itemTitle}>
                        {item.title || item.place?.name}
                      </Text>

                      <View style={styles.itemMetaRow}>
                        <Text style={styles.metaTime}>
                          ⏰ {item.timeSlot || '시간 미정'}
                        </Text>
                        {item.estimatedCost ? (
                          <Text style={styles.metaCost}>
                            💰 ₩{item.estimatedCost.toLocaleString()} (예상)
                          </Text>
                        ) : null}
                      </View>

                      {item.place?.address && (
                        <Text style={styles.itemAddress}>
                          📍 {item.place.address}
                        </Text>
                      )}

                      {item.memo ? (
                        <View style={styles.memoBox}>
                          <Text style={styles.memoText}>💡 {item.memo}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* 2. 지도 탭 (Map) */}
        {activeTab === 'map' && (
          <View style={styles.tabContent}>
            <View style={styles.mapBannerCard}>
              <View style={styles.mapBannerHeader}>
                <Ionicons name="map" size={22} color={colors.accent} />
                <Text style={styles.mapBannerTitle}>
                  DAY {selectedDayNumber} 장소 동선 지도
                </Text>
              </View>
              <Text style={styles.mapBannerDesc}>
                기획서 원칙에 따라 저장된 좌표를 기반으로 ① ② ③ 순서 마커를
                표시합니다.
              </Text>
            </View>

            {/* 마커 동선 카드 뷰 */}
            <View style={styles.markerContainer}>
              {filteredSchedule.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Ionicons
                    name="navigate-outline"
                    size={40}
                    color={colors.mutedLight}
                  />
                  <Text style={styles.emptyStateTitle}>
                    지도에 표시할 좌표 장소가 없습니다.
                  </Text>
                  <Text style={styles.emptyStateSub}>
                    일정에 명소나 식당을 먼저 추가해 주세요.
                  </Text>
                </View>
              ) : (
                filteredSchedule.map((item, idx) => (
                  <View key={item.id} style={styles.markerRow}>
                    <View style={styles.markerCircle}>
                      <Text style={styles.markerCircleText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.markerInfoCard}>
                      <Text style={styles.markerPlaceName}>
                        {item.title || item.place?.name}
                      </Text>
                      <Text style={styles.markerPlaceCoord}>
                        위도: {item.place?.latitude?.toFixed(4) || '33.5000'} /
                        경도:{item.place?.longitude?.toFixed(4) || '126.5000'}
                      </Text>
                      {item.timeSlot ? (
                        <Text style={styles.markerPlaceTime}>
                          방문 예정: {item.timeSlot}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* 3. 가계부 탭 (Expense) */}
        {activeTab === 'expense' && (
          <View style={styles.tabContent}>
            {/* 가계부 요약 카드 */}
            <View style={styles.expenseSummaryCard}>
              <Text style={styles.expenseSummaryTitle}>
                총 지출 및 예상 현황
              </Text>
              <View style={styles.summaryValuesRow}>
                <View style={styles.summaryValueItem}>
                  <Text style={styles.summaryLabel}>💳 실제 지출</Text>
                  <Text style={styles.summaryActualValue}>
                    ₩{expenseSummary.actual.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryValueItem}>
                  <Text style={styles.summaryLabel}>📈 예상 경비</Text>
                  <Text style={styles.summaryEstimatedValue}>
                    ₩{expenseSummary.estimated.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>지출 및 경비 내역</Text>
              <TouchableOpacity
                style={styles.actionPrimaryBtn}
                onPress={() => setIsExpenseModalOpen(true)}
              >
                <Ionicons name="add" size={16} color={colors.textLight} />
                <Text style={styles.actionPrimaryBtnText}>지출 등록</Text>
              </TouchableOpacity>
            </View>

            {/* 지출 리스트 */}
            {currentExpenses.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <Ionicons
                  name="cash-outline"
                  size={40}
                  color={colors.mutedLight}
                />
                <Text style={styles.emptyStateTitle}>
                  등록된 비용 내역이 없습니다.
                </Text>
                <Text style={styles.emptyStateSub}>
                  식비, 교통비, 입장료를 등록해 보세요.
                </Text>
              </View>
            ) : (
              currentExpenses.map((exp: Expense) => (
                <View key={exp.id} style={styles.expenseCard}>
                  <View style={styles.expenseLeft}>
                    <View
                      style={[
                        styles.expenseTypeBadge,
                        exp.isActual
                          ? styles.expenseActualBadge
                          : styles.expenseEstimateBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.expenseTypeBadgeText,
                          exp.isActual
                            ? styles.expenseActualBadgeText
                            : styles.expenseEstimateBadgeText,
                        ]}
                      >
                        {exp.isActual ? '실제 결제' : '예상 비용'}
                      </Text>
                    </View>
                    <Text style={styles.expenseItemTitle}>{exp.title}</Text>
                    <Text style={styles.expenseCategoryText}>
                      🏷️ {getExpenseCategoryLabel(exp.category)}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmountText}>
                    ₩{exp.amount.toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* 4. 체크리스트 탭 (Checklist) */}
        {activeTab === 'checklist' && (
          <View style={styles.tabContent}>
            {/* 준비물 추가 입력창 */}
            <View style={styles.checklistInputRow}>
              <TextInput
                style={styles.checklistInput}
                placeholder="준비물 입력 (예: 여권, 보조배터리)"
                value={newChecklistText}
                onChangeText={setNewChecklistText}
                onSubmitEditing={handleAddChecklist}
              />
              <TouchableOpacity
                style={styles.checklistAddBtn}
                onPress={handleAddChecklist}
              >
                <Ionicons name="add" size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            {/* 준비물 목록 */}
            <View style={styles.checklistContainer}>
              {currentChecklist.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Ionicons
                    name="list-outline"
                    size={40}
                    color={colors.mutedLight}
                  />
                  <Text style={styles.emptyStateTitle}>
                    체크리스트가 비어있습니다.
                  </Text>
                  <Text style={styles.emptyStateSub}>
                    잊기 쉬운 짐이나 준비물을 추가해 보세요!
                  </Text>
                </View>
              ) : (
                currentChecklist.map((item: ChecklistItem) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.checklistItemRow,
                      item.isCompleted && styles.checklistItemCompleted,
                    ]}
                    onPress={() => toggleChecklistItem(tripId, item.id)}
                  >
                    <Ionicons
                      name={item.isCompleted ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.isCompleted ? colors.accent : colors.muted}
                    />
                    <Text
                      style={[
                        styles.checklistItemText,
                        item.isCompleted && styles.checklistItemTextDone,
                      ]}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}

        {/* 5. 멤버 탭 (Members) */}
        {activeTab === 'members' && (
          <View style={styles.tabContent}>
            {/* 초대 공유 배너 */}
            <View style={styles.shareBanner}>
              <View>
                <Text style={styles.shareBannerTitle}>
                  친구와 함께 계획하기
                </Text>
                <Text style={styles.shareBannerSub}>
                  초대 링크를 보내면 실시간으로 일정을 함께 작성할 수 있습니다.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={handleShareTrip}
              >
                <Ionicons name="link" size={16} color={colors.textLight} />
                <Text style={styles.inviteButtonText}>초대 링크 복사</Text>
              </TouchableOpacity>
            </View>

            {/* 참여 멤버 리스트 */}
            <Text style={styles.sectionTitle}>
              참여 멤버 ({currentMembers.length}명)
            </Text>
            <View style={styles.membersList}>
              {currentMembers.map((member: TripMember) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.userId === 'user-me'
                        ? '나 (본인)'
                        : member.userId}
                    </Text>
                    <Text style={styles.memberRole}>
                      {member.role === 'owner'
                        ? '👑 방장 (Owner)'
                        : member.role === 'editor'
                          ? '✏️ 편집자 (Editor)'
                          : '👀 뷰어 (Viewer)'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 일정 추가 모달 */}
      <Modal visible={isScheduleModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                DAY {selectedDayNumber} 일정 추가
              </Text>
              <TouchableOpacity onPress={() => setIsScheduleModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* 유형 선택 칩 */}
            <View style={styles.typeRow}>
              {(
                [
                  { type: 'PLACE', label: '명소/식당' },
                  { type: 'STAY', label: '숙소' },
                  { type: 'TRANSPORT', label: '교통/이동' },
                  { type: 'MEMO', label: '메모/팁' },
                ] as const
              ).map((t) => (
                <TouchableOpacity
                  key={t.type}
                  style={[
                    styles.typeChip,
                    newType === t.type && styles.typeChipActive,
                  ]}
                  onPress={() => setNewType(t.type)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      newType === t.type && styles.typeChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="일정/장소명 (예: 오사카성, 호텔 체크인)"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="방문 예정 시간 (예: 14:00)"
              value={newTime}
              onChangeText={setNewTime}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="예상 비용 (원 단위, 예: 25000)"
              keyboardType="numeric"
              value={newCost}
              onChangeText={setNewCost}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="메모 및 꿀팁 (선택 사항)"
              value={newMemo}
              onChangeText={setNewMemo}
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleAddSchedule}
            >
              <Text style={styles.modalSubmitBtnText}>일정에 등록</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 지출 등록 모달 */}
      <Modal visible={isExpenseModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>가계부 항목 등록</Text>
              <TouchableOpacity onPress={() => setIsExpenseModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* 실제/예상 토글 */}
            <View style={styles.actualToggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  expIsActual && styles.toggleBtnActive,
                ]}
                onPress={() => setExpIsActual(true)}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    expIsActual && styles.toggleBtnTextActive,
                  ]}
                >
                  💳 실제 지출
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  !expIsActual && styles.toggleBtnActive,
                ]}
                onPress={() => setExpIsActual(false)}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    !expIsActual && styles.toggleBtnTextActive,
                  ]}
                >
                  📈 예상 경비
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="지출 항목명 (예: 돈카츠 정식, 지하철 패스)"
              value={expTitle}
              onChangeText={setExpTitle}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="금액 (원 단위, 예: 18000)"
              keyboardType="numeric"
              value={expAmount}
              onChangeText={setExpAmount}
            />

            {/* 카테고리 선택 칩 */}
            <View style={styles.typeRow}>
              {(
                [
                  'food',
                  'transport',
                  'stay',
                  'activity',
                  'shopping',
                  'etc',
                ] as const
              ).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.typeChip,
                    expCategory === cat && styles.typeChipActive,
                  ]}
                  onPress={() => setExpCategory(cat)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      expCategory === cat && styles.typeChipTextActive,
                    ]}
                  >
                    {getExpenseCategoryLabel(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleAddExpense}
            >
              <Text style={styles.modalSubmitBtnText}>비용 등록</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 화면 스타일을 정의한다.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navIconBtn: { padding: 4 },
  navTitleContainer: { flex: 1, marginLeft: 8 },
  navTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  navSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  navShareBtn: { padding: 6 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.accent },
  tabLabel: { fontSize: 11, fontWeight: '700', color: colors.muted },
  tabLabelActive: { color: colors.accent },
  tabContent: { gap: 16, marginTop: 12 },
  dayScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayChipLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  dayChipLabelActive: { color: colors.textLight },
  dayChipSub: { fontSize: 10, color: colors.muted, marginTop: 2 },
  dayChipSubActive: { color: 'rgba(255,255,255,0.85)' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  sectionSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actionPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  actionPrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
  },
  emptyStateBox: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  emptyStateTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyStateSub: { fontSize: 12, color: colors.muted },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineIndexCol: { width: 32, alignItems: 'center' },
  timelineBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  timelineVerticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  scheduleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },
  checkInChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  checkInChipText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  itemTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  itemMetaRow: { flexDirection: 'row', gap: 12 },
  metaTime: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  metaCost: { fontSize: 12, color: colors.accentDark, fontWeight: '700' },
  itemAddress: { fontSize: 11, color: colors.muted },
  memoBox: {
    backgroundColor: colors.borderLight,
    padding: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  memoText: { fontSize: 11, color: colors.text, lineHeight: 16 },
  mapBannerCard: {
    backgroundColor: colors.accentSoft,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(36, 106, 84, 0.2)',
    gap: 6,
  },
  mapBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapBannerTitle: { fontSize: 15, fontWeight: '800', color: colors.accentDark },
  mapBannerDesc: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  markerContainer: { gap: 10 },
  markerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCircleText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textLight,
  },
  markerInfoCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  markerPlaceName: { fontSize: 14, fontWeight: '700', color: colors.text },
  markerPlaceCoord: { fontSize: 11, color: colors.muted },
  markerPlaceTime: { fontSize: 11, color: colors.accent, fontWeight: '600' },
  expenseSummaryCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  expenseSummaryTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  summaryValuesRow: { flexDirection: 'row', alignItems: 'center' },
  summaryValueItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  summaryLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  summaryActualValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.tagOrangeText,
  },
  summaryEstimatedValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expenseLeft: { gap: 4 },
  expenseTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expenseActualBadge: { backgroundColor: colors.tagOrange },
  expenseEstimateBadge: { backgroundColor: colors.accentSoft },
  expenseTypeBadgeText: { fontSize: 10, fontWeight: '700' },
  expenseActualBadgeText: { color: colors.tagOrangeText },
  expenseEstimateBadgeText: { color: colors.accent },
  expenseItemTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  expenseCategoryText: { fontSize: 11, color: colors.muted },
  expenseAmountText: { fontSize: 15, fontWeight: '800', color: colors.text },
  checklistInputRow: { flexDirection: 'row', gap: 8 },
  checklistInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  checklistAddBtn: {
    backgroundColor: colors.accent,
    width: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistContainer: { gap: 8 },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checklistItemCompleted: { opacity: 0.6 },
  checklistItemText: { fontSize: 14, fontWeight: '600', color: colors.text },
  checklistItemTextDone: { textDecorationLine: 'line-through' },
  shareBanner: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  shareBannerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  shareBannerSub: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  inviteButtonText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  membersList: { gap: 10 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: { gap: 2 },
  memberName: { fontSize: 14, fontWeight: '700', color: colors.text },
  memberRole: { fontSize: 11, color: colors.muted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  typeChipActive: { backgroundColor: colors.accent },
  typeChipText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  typeChipTextActive: { color: colors.textLight },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.background,
  },
  actualToggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  toggleBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  toggleBtnTextActive: { color: colors.accent },
  modalSubmitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalSubmitBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.text },
  backButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  backButtonText: { color: colors.textLight, fontWeight: '700' },
});
