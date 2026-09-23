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
import type { Trip, TripStatus } from '@wherego/domain';

// 여행 커버 테마 색상 옵션을 정의한다.
const coverColorOptions = [
  { label: '코랄 오렌지', color: '#F45135' },
  { label: '스카이 블루', color: '#3D8DFF' },
  { label: '포레스트 그린', color: '#246A54' },
  { label: '로열 퍼플', color: '#7B1FA2' },
  { label: '선셋 골드', color: '#E65100' },
];

// 여행 상태별 라벨과 배지 스타일을 반환한다.
function getTripStatusBadge(status: TripStatus) {
  switch (status) {
    case 'IN_PROGRESS':
      return {
        label: '여행 중',
        bg: colors.tagOrange,
        text: colors.tagOrangeText,
      };
    case 'COMPLETED':
      return {
        label: '여행 완료',
        bg: colors.borderLight,
        text: colors.muted,
      };
    case 'ARCHIVED':
      return {
        label: '보관됨',
        bg: colors.borderLight,
        text: colors.muted,
      };
    case 'PLANNED':
    default:
      return {
        label: '여행 예정',
        bg: colors.tagBlue,
        text: colors.tagBlueText,
      };
  }
}

// 오늘 날짜 기준 D-Day 문자열을 계산한다.
function calculateDDay(startDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diffTime = start.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'D-Day 오늘';
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
}

// [내 여행] 목록 및 여행 생성/참여 허브 화면을 렌더링한다.
export default function MyTripsScreen() {
  const router = useRouter();

  // 전역 여행 스토어 상태 및 액션을 구독한다.
  const {
    currentUser,
    trips,
    createTrip,
    deleteTrip,
    joinTripByInviteCode,
    setSelectedTripId,
  } = useTripStore();

  // 여행 생성 모달 노출 상태를 관리한다.
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // 여행 제목 입력값을 관리한다.
  const [titleInput, setTitleInput] = useState('');
  // 여행 국가 입력값을 관리한다.
  const [countryInput, setCountryInput] = useState('일본');
  // 여행 도시 입력값을 관리한다.
  const [cityInput, setCityInput] = useState('와카야마');
  // 여행 시작일 입력값을 관리한다.
  const [startDateInput, setStartDateInput] = useState('2026-10-03');
  // 여행 종료일 입력값을 관리한다.
  const [endDateInput, setEndDateInput] = useState('2026-10-08');
  // 선택된 커버 색상을 관리한다.
  const [selectedColor, setSelectedColor] = useState('#F45135');

  // 초대 코드 참여 모달 노출 상태를 관리한다.
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  // 입력된 초대 코드를 관리한다.
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  // 새로운 여행을 생성하고 상세 화면으로 이동한다.
  const handleConfirmCreateTrip = () => {
    // 제목 입력 여부를 검사한다.
    if (!titleInput.trim()) {
      Alert.alert('알림', '여행 제목을 입력해 주세요.');
      return;
    }
    // 시작일과 종료일 입력 여부를 검사한다.
    if (!startDateInput.trim() || !endDateInput.trim()) {
      Alert.alert('알림', '여행 시작일과 종료일을 입력해 주세요.');
      return;
    }

    // 날짜 유효성을 검사한다.
    if (new Date(startDateInput) > new Date(endDateInput)) {
      Alert.alert('알림', '시작일은 종료일보다 이전이어야 합니다.');
      return;
    }

    // 스토어에 새 여행을 생성한다.
    const created = createTrip({
      title: titleInput.trim(),
      country: countryInput.trim() || '대한민국',
      city: cityInput.trim() || '여행지',
      startDate: startDateInput.trim(),
      endDate: endDateInput.trim(),
      status: 'PLANNED',
      coverColor: selectedColor,
    });

    // 모달을 닫고 폼 필드를 초기화한다.
    setIsCreateModalOpen(false);
    setTitleInput('');

    // 생성된 여행의 상세 페이지로 즉시 이동한다.
    setSelectedTripId(created.id);
    router.push(`/trips/${created.id}`);
  };

  // 초대 코드로 여행에 참여한다.
  const handleConfirmJoinTrip = () => {
    // 초대 코드 입력 여부를 검사한다.
    if (!inviteCodeInput.trim()) {
      Alert.alert('알림', '전달받은 6자리 초대 코드를 입력해 주세요.');
      return;
    }

    // 스토어의 초대 코드 참여 액션을 실행한다.
    const result = joinTripByInviteCode(inviteCodeInput.trim());

    if (!result.success || !result.trip) {
      Alert.alert('참여 실패', result.message);
      return;
    }

    // 참여 성공 피드백을 제공하고 해당 여행 상세로 이동한다.
    Alert.alert('참여 완료', result.message, [
      {
        text: '일정 확인하기',
        onPress: () => {
          setIsJoinModalOpen(false);
          setInviteCodeInput('');
          setSelectedTripId(result.trip!.id);
          router.push(`/trips/${result.trip!.id}`);
        },
      },
    ]);
  };

  // 여행 카드를 클릭하여 상세 화면으로 이동한다.
  const handleSelectTrip = (trip: Trip) => {
    // 활성 여행 아이디를 설정하고 화면을 전환한다.
    setSelectedTripId(trip.id);
    router.push(`/trips/${trip.id}`);
  };

  // 여행을 삭제한다.
  const handleDeleteTrip = (trip: Trip) => {
    Alert.alert(
      '여행 삭제',
      `'${trip.title}' 일정을 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteTrip(trip.id),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* 상단 헤더 바 */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.pageTitle}>내 여행</Text>
          <Text style={styles.pageSubtitle}>
            {currentUser?.nickname
              ? `${currentUser.nickname}님의 여행 계획`
              : '로그인 후 직접 여행을 계획해 보세요'}
          </Text>
        </View>

        {/* 상단 액션 버튼 그룹 */}
        <View style={styles.headerBtnRow}>
          <TouchableOpacity
            style={styles.joinCodeBtn}
            onPress={() => setIsJoinModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="key-outline" size={16} color={colors.secondary} />
            <Text style={styles.joinCodeBtnText}>코드 참여</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addTripBtn}
            onPress={() => setIsCreateModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color={colors.textLight} />
            <Text style={styles.addTripBtnText}>새 여행</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 여행 목록이 비어 있는 경우 (Empty State) */}
        {trips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="map-outline" size={48} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              아직 등록된 여행 일정이 없습니다
            </Text>
            <Text style={styles.emptyDesc}>
              {
                '새로운 여행 계획을 직접 만들어 보거나,\n친구에게 전달받은 초대 코드를 입력해 동행에 참여하세요!'
              }
            </Text>

            <View style={styles.emptyBtnGroup}>
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                onPress={() => setIsCreateModalOpen(true)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={colors.textLight}
                />
                <Text style={styles.emptyPrimaryBtnText}>
                  + 첫 번째 여행 계획 만들기
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emptySubBtn}
                onPress={() => setIsJoinModalOpen(true)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={colors.secondary}
                />
                <Text style={styles.emptySubBtnText}>초대 코드로 참여하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // 등록된 여행 카드 목록
          <View style={styles.tripList}>
            {trips.map((trip) => {
              const badge = getTripStatusBadge(trip.status);
              const dday = calculateDDay(trip.startDate);

              return (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.tripCard}
                  onPress={() => handleSelectTrip(trip)}
                  activeOpacity={0.85}
                >
                  {/* 좌측 테마 컬러 바 */}
                  <View
                    style={[
                      styles.cardColorBar,
                      { backgroundColor: trip.coverColor || colors.primary },
                    ]}
                  />

                  <View style={styles.cardMain}>
                    {/* 상단 상태 배지 및 D-Day */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: badge.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: badge.text },
                            ]}
                          >
                            {badge.label}
                          </Text>
                        </View>
                        <View style={styles.ddayBadge}>
                          <Text style={styles.ddayBadgeText}>{dday}</Text>
                        </View>
                      </View>

                      {/* 삭제 버튼 */}
                      <TouchableOpacity
                        style={styles.deleteIconBtn}
                        onPress={() => handleDeleteTrip(trip)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.mutedLight}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* 여행 제목 */}
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {trip.title}
                    </Text>

                    {/* 여행지 및 기간 */}
                    <View style={styles.cardMetaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={colors.muted}
                        />
                        <Text style={styles.metaText}>
                          {trip.country} · {trip.city}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="calendar-outline"
                          size={14}
                          color={colors.muted}
                        />
                        <Text style={styles.metaText}>
                          {trip.startDate} ~ {trip.endDate}
                        </Text>
                      </View>
                    </View>

                    {/* 하단 초대 코드 안내 */}
                    <View style={styles.cardFooterRow}>
                      <View style={styles.inviteBadge}>
                        <Ionicons
                          name="key-outline"
                          size={12}
                          color={colors.muted}
                        />
                        <Text style={styles.inviteBadgeText}>
                          초대 코드: {trip.inviteCode || '미발급'}
                        </Text>
                      </View>
                      <View style={styles.detailLink}>
                        <Text style={styles.detailLinkText}>일정 보기</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={colors.primary}
                        />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 새 여행 만들기 모달 */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>새 여행 만들기</Text>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              showsVerticalScrollIndicator={false}
            >
              {/* 여행 제목 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>여행 제목 *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="예: 와카야마 힐링 투어, 오사카 3박 4일"
                  placeholderTextColor={colors.mutedLight}
                  value={titleInput}
                  onChangeText={setTitleInput}
                />
              </View>

              {/* 여행 국가 & 도시 */}
              <View style={styles.twoColumnRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>국가</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="예: 일본"
                    placeholderTextColor={colors.mutedLight}
                    value={countryInput}
                    onChangeText={setCountryInput}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>대표 도시</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="예: 와카야마"
                    placeholderTextColor={colors.mutedLight}
                    value={cityInput}
                    onChangeText={setCityInput}
                  />
                </View>
              </View>

              {/* 시작일 & 종료일 */}
              <View style={styles.twoColumnRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>시작일 (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="2026-10-03"
                    placeholderTextColor={colors.mutedLight}
                    value={startDateInput}
                    onChangeText={setStartDateInput}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>종료일 (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="2026-10-08"
                    placeholderTextColor={colors.mutedLight}
                    value={endDateInput}
                    onChangeText={setEndDateInput}
                  />
                </View>
              </View>

              {/* 테마 색상 선택 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>테마 대표 색상</Text>
                <View style={styles.colorPaletteRow}>
                  {coverColorOptions.map((item) => {
                    const isSelected = selectedColor === item.color;
                    return (
                      <TouchableOpacity
                        key={item.color}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: item.color },
                          isSelected && styles.colorCircleActive,
                        ]}
                        onPress={() => setSelectedColor(item.color)}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={colors.textLight}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* 모달 하단 버튼 */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.confirmSubmitBtn}
                onPress={handleConfirmCreateTrip}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmSubmitBtnText}>
                  여행 생성하고 일정 짜기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 초대 코드 참여 모달 */}
      <Modal
        visible={isJoinModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsJoinModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardSmall}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>초대 코드로 참여</Text>
              <TouchableOpacity
                onPress={() => setIsJoinModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.joinModalBody}>
              <Text style={styles.joinDesc}>
                친구에게 전달받은 6자리 초대 코드를 입력하면 해당 여행의 동행
                멤버로 참여할 수 있습니다.
              </Text>

              <TextInput
                style={styles.joinInput}
                placeholder="예: 7X9B2K"
                placeholderTextColor={colors.mutedLight}
                autoCapitalize="characters"
                maxLength={10}
                value={inviteCodeInput}
                onChangeText={setInviteCodeInput}
              />

              <TouchableOpacity
                style={styles.joinConfirmBtn}
                onPress={handleConfirmJoinTrip}
                activeOpacity={0.85}
              >
                <Text style={styles.joinConfirmBtnText}>참여하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// [내 여행] 화면의 스타일을 정의한다.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitleWrap: {
    gap: 2,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  headerBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondarySoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinCodeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  addTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addTripBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtnGroup: {
    marginTop: 16,
    gap: 10,
    width: '100%',
    maxWidth: 280,
  },
  emptyPrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyPrimaryBtnText: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubBtn: {
    backgroundColor: colors.secondarySoft,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptySubBtnText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tripList: {
    gap: 14,
  },
  tripCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardColorBar: {
    width: 6,
  },
  cardMain: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ddayBadge: {
    backgroundColor: colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ddayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  deleteIconBtn: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.muted,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 4,
  },
  inviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inviteBadgeText: {
    fontSize: 11,
    color: colors.muted,
  },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalCardSmall: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  modalForm: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: colors.text,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  confirmSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSubmitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textLight,
  },
  joinModalBody: {
    paddingTop: 12,
    gap: 14,
  },
  joinDesc: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  joinInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    color: colors.text,
  },
  joinConfirmBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  joinConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textLight,
  },
});
