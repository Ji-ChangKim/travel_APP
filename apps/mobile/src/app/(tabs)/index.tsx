import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { useTripStore } from '@/stores/useTripStore';
import type { ItineraryItem, PlaceCategory, TripStatus } from '@wherego/domain';
import { tripCreateSchema } from '@wherego/validation';

// 상태별 배지 색상 및 라벨 정보를 반환한다.
function getStatusBadge(status: TripStatus) {
  // 여행 진행 상태에 따라 적합한 라벨과 색상 객체를 반환한다.
  switch (status) {
    case 'IN_PROGRESS':
      return {
        label: '여행 중',
        bg: colors.tagOrange,
        text: colors.tagOrangeText,
      };
    case 'COMPLETED':
      return { label: '여행 완료', bg: colors.borderLight, text: colors.muted };
    case 'ARCHIVED':
      return { label: '보관됨', bg: colors.borderLight, text: colors.muted };
    case 'PLANNED':
    default:
      return { label: '여행 예정', bg: colors.accentSoft, text: colors.accent };
  }
}

// 카테고리별 배지 스타일을 반환한다.
function getCategoryBadge(category: PlaceCategory) {
  // 장소 카테고리에 맞는 스타일 객체를 반환한다.
  switch (category) {
    case 'food':
      return {
        label: '식당',
        bg: colors.tagOrange,
        text: colors.tagOrangeText,
      };
    case 'cafe':
      return {
        label: '카페',
        bg: colors.tagPurple,
        text: colors.tagPurpleText,
      };
    case 'stay':
      return { label: '숙소', bg: colors.tagBlue, text: colors.tagBlueText };
    case 'activity':
      return {
        label: '액티비티',
        bg: colors.accentSoft,
        text: colors.accentDark,
      };
    case 'sightseeing':
    default:
      return { label: '관광지', bg: colors.accentSoft, text: colors.accent };
  }
}

// [내 여행] 화면을 렌더링한다.
export default function MyTripsScreen() {
  // 페이지 이동을 위한 Expo 라우터 인스턴스를 가져온다.
  const router = useRouter();

  // 여행 전역 스토어 상태 및 액션을 구독한다.
  const {
    trips,
    selectedTripId,
    itineraries,
    setSelectedTripId,
    createTrip,
    updateTripStatus,
    addItineraryItem,
    checkInPlace,
  } = useTripStore();

  const [filterStatus, setFilterStatus] = useState<TripStatus | 'ALL'>('ALL');

  // 여행 생성 모달
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCountry, setFormCountry] = useState('대한민국');
  const [formCity, setFormCity] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  // 일정 추가 모달
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeTime, setPlaceTime] = useState('11:00');
  const [placeCategory, setPlaceCategory] =
    useState<PlaceCategory>('sightseeing');
  const [placeMemo, setPlaceMemo] = useState('');

  // 필터링된 여행 목록을 구한다.
  const filteredTrips = trips.filter((t) =>
    filterStatus === 'ALL' ? true : t.status === filterStatus,
  );

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || trips[0];
  const currentItinerary = selectedTrip
    ? itineraries[selectedTrip.id] || []
    : [];

  // Zod 검증을 거쳐 새로운 여행을 생성하고 상세 허브로 이동한다.
  const handleCreateTrip = () => {
    // 폼 입력값을 정리한다.
    const input = {
      title: formTitle.trim(),
      country: formCountry.trim(),
      city: formCity.trim(),
      startDate: formStartDate.trim(),
      endDate: formEndDate.trim(),
      coverColor: '#246A54',
    };

    // Zod 스키마 검증을 수행한다.
    const validationResult = tripCreateSchema.safeParse(input);
    if (!validationResult.success) {
      // 검증 실패 시 오류 메시지를 표시한다.
      const errorMsg =
        validationResult.error.errors[0]?.message || '입력값을 확인해 주세요.';
      Alert.alert('입력 오류', errorMsg);
      return;
    }

    // 여행을 생성하고 생성된 인스턴스를 받는다.
    const createdTrip = createTrip({
      ...input,
      status: 'PLANNED',
    });

    // 폼 상태를 초기화하고 모달을 닫는다.
    setIsTripModalOpen(false);
    setFormTitle('');
    setFormCity('');
    setFormStartDate('');
    setFormEndDate('');

    // 생성된 여행의 상세 허브 화면으로 즉시 이동한다.
    router.push(`/trips/${createdTrip.id}`);
  };

  // 새로운 장소 일정을 추가한다.
  const handleAddPlace = () => {
    // 장소 이름 유효성을 검사한다.
    if (!placeName.trim() || !selectedTrip) {
      Alert.alert('알림', '장소 이름을 입력해 주세요.');
      return;
    }

    // 일정을 스토어에 추가한다.
    addItineraryItem(selectedTrip.id, {
      tripDayId: 'day-1',
      placeId: `place-${Date.now()}`,
      timeSlot: placeTime.trim() || '12:00',
      sortOrder: currentItinerary.length + 1,
      memo: placeMemo.trim(),
      place: {
        id: `place-${Date.now()}`,
        name: placeName.trim(),
        category: placeCategory,
        latitude: 33.5066,
        longitude: 126.493,
        createdAt: new Date().toISOString(),
      },
    });

    // 모달을 닫고 인풋 필드를 초기화한다.
    setIsPlaceModalOpen(false);
    setPlaceName('');
    setPlaceMemo('');
  };

  // 예정된 일정 장소를 방문 체크인하여 발자국으로 전환한다.
  const handleCheckIn = (item: ItineraryItem) => {
    // 활성 여행이 없으면 중단한다.
    if (!selectedTrip) return;
    // 발자국 등록을 실행한다.
    checkInPlace(selectedTrip.id, item, 'gps');
    // 체크인 안내 알림을 표시한다.
    Alert.alert(
      '체크인 완료 (발자국 등록)',
      `'${item.place?.name}'에 체크인했습니다!\n[발자국] 탭에서 확인하실 수 있습니다.`,
    );
  };

  // 여행 상세 허브 화면으로 이동한다.
  const navigateToTripDetail = (tripId: string) => {
    // 해당 여행 ID의 상세 페이지로 경로를 이동한다.
    router.push(`/trips/${tripId}`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 상단 헤더 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>WHEREGO</Text>
            <Text style={styles.headerTitle}>내 여행</Text>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setIsTripModalOpen(true)}
          >
            <Ionicons name="add" size={20} color={colors.textLight} />
            <Text style={styles.createButtonText}>새 여행 생성</Text>
          </TouchableOpacity>
        </View>

        {/* 상태 필터 탭 (전체 / 예정 / 여행 중 / 완료) */}
        <View style={styles.filterRow}>
          {(['ALL', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const).map(
            (st) => {
              const isSelected = filterStatus === st;
              const label =
                st === 'ALL'
                  ? '전체'
                  : st === 'PLANNED'
                    ? '예정'
                    : st === 'IN_PROGRESS'
                      ? '여행 중'
                      : '완료';
              return (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterStatus(st)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </View>

        {/* 여행 카드 목록 슬라이드 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tripScroll}
        >
          {filteredTrips.map((trip) => {
            const isSelected = trip.id === selectedTrip?.id;
            const badge = getStatusBadge(trip.status);
            return (
              <TouchableOpacity
                key={trip.id}
                style={[styles.tripCard, isSelected && styles.tripCardSelected]}
                onPress={() => setSelectedTripId(trip.id)}
              >
                <View style={styles.tripCardTop}>
                  <Text style={styles.tripLocation}>
                    📍 {trip.country} · {trip.city}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.tripTitle} numberOfLines={1}>
                  {trip.title}
                </Text>
                <Text style={styles.tripDates}>
                  🗓️ {trip.startDate} ~ {trip.endDate}
                </Text>

                {/* 여행 상세 허브 열기 바로가기 버튼 */}
                <TouchableOpacity
                  style={styles.openHubBtn}
                  onPress={() => navigateToTripDetail(trip.id)}
                >
                  <Text style={styles.openHubBtnText}>통합 허브 열기</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 선택된 여행 상세 및 일정 섹션 */}
        {selectedTrip && (
          <View style={styles.itinerarySection}>
            {/* 기획서 v0.3 기반 5대 허브 진입 배너 */}
            <TouchableOpacity
              style={styles.hubBanner}
              onPress={() => navigateToTripDetail(selectedTrip.id)}
            >
              <View style={styles.hubBannerLeft}>
                <Ionicons name="sparkles" size={20} color={colors.textLight} />
                <View>
                  <Text style={styles.hubBannerTitle}>
                    {selectedTrip.title} 통합 허브
                  </Text>
                  <Text style={styles.hubBannerSub}>
                    일정 · 지도 동선 · 가계부 · 준비물 · 멤버 관리
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textLight}
              />
            </TouchableOpacity>

            <View style={styles.itineraryHeader}>
              <View>
                <Text style={styles.itinerarySubtitle}>
                  {selectedTrip.city} 여행 코스
                </Text>
                <Text style={styles.itineraryTitle}>
                  날짜별 계획 ({currentItinerary.length}개 장소)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addPlaceBtn}
                onPress={() => setIsPlaceModalOpen(true)}
              >
                <Ionicons name="add-circle" size={18} color={colors.accent} />
                <Text style={styles.addPlaceBtnText}>장소 등록</Text>
              </TouchableOpacity>
            </View>

            {/* 일정 장소 목록 */}
            <View style={styles.itineraryList}>
              {currentItinerary.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="map-outline"
                    size={36}
                    color={colors.mutedLight}
                  />
                  <Text style={styles.emptyCardTitle}>
                    등록된 일정이 없습니다.
                  </Text>
                  <Text style={styles.emptyCardSub}>
                    숙소, 식당, 관광지를 직접 추가해 보세요!
                  </Text>
                </View>
              ) : (
                currentItinerary.map((item, idx) => {
                  const catBadge = getCategoryBadge(
                    item.place?.category || 'sightseeing',
                  );
                  return (
                    <View key={item.id} style={styles.itineraryItem}>
                      <View style={styles.timeColumn}>
                        <Text style={styles.timeText}>
                          {item.timeSlot || '시간 미정'}
                        </Text>
                        <View style={styles.timelineBar} />
                      </View>
                      <View style={styles.placeCard}>
                        <View style={styles.placeCardHeader}>
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: catBadge.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                { color: catBadge.text },
                              ]}
                            >
                              {catBadge.label}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.checkInBtn}
                            onPress={() => handleCheckIn(item)}
                          >
                            <Ionicons
                              name="location-outline"
                              size={14}
                              color={colors.accent}
                            />
                            <Text style={styles.checkInBtnText}>체크인</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.placeName}>
                          {idx + 1}. {item.place?.name}
                        </Text>
                        {item.place?.address && (
                          <Text style={styles.placeAddress}>
                            {item.place.address}
                          </Text>
                        )}
                        {item.memo ? (
                          <Text style={styles.placeMemo}>💡 {item.memo}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* 상태 변경 퀵 버튼 */}
            <View style={styles.statusChangeRow}>
              <Text style={styles.statusChangeLabel}>여행 상태 변경:</Text>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  selectedTrip.status === 'IN_PROGRESS' &&
                    styles.statusButtonActive,
                ]}
                onPress={() => updateTripStatus(selectedTrip.id, 'IN_PROGRESS')}
              >
                <Text style={styles.statusButtonText}>여행 시작</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  selectedTrip.status === 'COMPLETED' &&
                    styles.statusButtonActive,
                ]}
                onPress={() => updateTripStatus(selectedTrip.id, 'COMPLETED')}
              >
                <Text style={styles.statusButtonText}>
                  여행 완료 (발자국 전환)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 여행 생성 모달 */}
      <Modal visible={isTripModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>새 여행 생성</Text>
              <TouchableOpacity onPress={() => setIsTripModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="여행 제목 (예: 도쿄 미식 탐방)"
              value={formTitle}
              onChangeText={setFormTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="국가 (예: 대한민국, 일본)"
              value={formCountry}
              onChangeText={setFormCountry}
            />
            <TextInput
              style={styles.input}
              placeholder="도시 (예: 서울, 도쿄, 제주)"
              value={formCity}
              onChangeText={setFormCity}
            />
            <TextInput
              style={styles.input}
              placeholder="시작일 (YYYY-MM-DD)"
              value={formStartDate}
              onChangeText={setFormStartDate}
            />
            <TextInput
              style={styles.input}
              placeholder="종료일 (YYYY-MM-DD)"
              value={formEndDate}
              onChangeText={setFormEndDate}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreateTrip}
            >
              <Text style={styles.submitBtnText}>여행 생성하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 장소 등록 모달 */}
      <Modal visible={isPlaceModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>일정에 장소 등록</Text>
              <TouchableOpacity onPress={() => setIsPlaceModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {/* 카테고리 선택 */}
            <View style={styles.catRow}>
              {(
                ['sightseeing', 'food', 'cafe', 'stay', 'activity'] as const
              ).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    placeCategory === cat && styles.catChipActive,
                  ]}
                  onPress={() => setPlaceCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      placeCategory === cat && styles.catChipTextActive,
                    ]}
                  >
                    {cat === 'sightseeing'
                      ? '관광지'
                      : cat === 'food'
                        ? '식당'
                        : cat === 'cafe'
                          ? '카페'
                          : cat === 'stay'
                            ? '숙소'
                            : '액티비티'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="장소명 (예: 오사카성, 안목해변)"
              value={placeName}
              onChangeText={setPlaceName}
            />
            <TextInput
              style={styles.input}
              placeholder="방문 예정 시간 (HH:MM)"
              value={placeTime}
              onChangeText={setPlaceTime}
            />
            <TextInput
              style={styles.input}
              placeholder="메모 (예: 사전 예약 필수, 주차 가능)"
              value={placeMemo}
              onChangeText={setPlaceMemo}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddPlace}>
              <Text style={styles.submitBtnText}>일정에 추가</Text>
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
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, gap: 18 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.accent,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 4,
  },
  createButtonText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  filterChipTextActive: { color: colors.textLight },
  tripScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  tripCard: {
    width: 240,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginRight: 12,
    gap: 8,
  },
  tripCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tripCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripLocation: { fontSize: 13, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tripTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  tripDates: { fontSize: 12, color: colors.muted },
  openHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
    marginTop: 4,
  },
  openHubBtnText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  hubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  hubBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hubBannerTitle: { fontSize: 15, fontWeight: '800', color: colors.textLight },
  hubBannerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  itinerarySection: { gap: 14 },
  itineraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itinerarySubtitle: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  itineraryTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  addPlaceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addPlaceBtnText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  itineraryList: { gap: 12 },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    gap: 6,
  },
  emptyCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyCardSub: { fontSize: 12, color: colors.muted },
  itineraryItem: { flexDirection: 'row', gap: 12 },
  timeColumn: { width: 44, alignItems: 'center' },
  timeText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  timelineBar: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  placeCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  placeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkInBtnText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  placeName: { fontSize: 15, fontWeight: '700', color: colors.text },
  placeAddress: { fontSize: 12, color: colors.muted },
  placeMemo: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  statusChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  statusChangeLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  statusButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  statusButtonText: { fontSize: 12, fontWeight: '700', color: colors.text },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  catChipActive: { backgroundColor: colors.accent },
  catChipText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  catChipTextActive: { color: colors.textLight },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.background,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: colors.textLight, fontWeight: '700', fontSize: 14 },
});
