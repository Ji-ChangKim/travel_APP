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
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import type { PlaceCategory, ScheduleType } from '@wherego/domain';

// QuickAddModal 컴포넌트의 Props를 정의한다.
interface QuickAddModalProps {
  visible: boolean;
  dayNumber: number;
  tripTitle: string;
  onClose: () => void;
  onAddSchedule: (scheduleData: {
    type: ScheduleType;
    title: string;
    timeSlot: string;
    estimatedCost: number;
    memo: string;
    placeCategory: PlaceCategory;
    transitInfo?: string;
  }) => void;
}

// 지원하는 5대 일정 유형을 정의한다.
const scheduleTypeOptions: {
  type: ScheduleType;
  label: string;
  subLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    type: 'PLACE',
    label: '장소',
    subLabel: '식당, 카페, 관광',
    icon: 'restaurant-outline',
  },
  {
    type: 'TRANSPORT',
    label: '이동',
    subLabel: '기차, 버스, 항공',
    icon: 'bus-outline',
  },
  {
    type: 'STAY',
    label: '숙소',
    subLabel: '호텔, 료칸, 캠핑',
    icon: 'bed-outline',
  },
  {
    type: 'RESERVATION',
    label: '예약',
    subLabel: '투어, 티켓, 액티비티',
    icon: 'ticket-outline',
  },
  {
    type: 'MEMO',
    label: '메모',
    subLabel: '자유 텍스트 메모',
    icon: 'document-text-outline',
  },
];

// 시안 기반의 Quick Add(일정 추가 및 장소 등록) 모달 컴포넌트를 렌더링한다.
export function QuickAddModal({
  visible,
  dayNumber,
  tripTitle,
  onClose,
  onAddSchedule,
}: QuickAddModalProps) {
  // 선택된 일정 유형 상태를 관리한다.
  const [selectedType, setSelectedType] = useState<ScheduleType>('PLACE');
  // 일정 제목/장소명 입력 상태를 관리한다.
  const [title, setTitle] = useState('');
  // 방문/이용 예정 시간 상태를 관리한다.
  const [timeSlot, setTimeSlot] = useState('11:00');
  // 예상 지출 경비 입력 상태를 관리한다.
  const [costInput, setCostInput] = useState('');
  // 참고 메모/팁 입력 상태를 관리한다.
  const [memo, setMemo] = useState('');
  // 이동 안내 정보 입력 상태를 관리한다.
  const [transitInfo, setTransitInfo] = useState('');

  // 폼 입력을 초기 상태로 리셋한다.
  const resetForm = () => {
    // 모든 텍스트 및 기본값을 초기화한다.
    setTitle('');
    setTimeSlot('11:00');
    setCostInput('');
    setMemo('');
    setTransitInfo('');
    setSelectedType('PLACE');
  };

  // 모달 닫기 요청을 처리한다.
  const handleClose = () => {
    // 입력을 리셋하고 상위 닫기 콜백을 호출한다.
    resetForm();
    onClose();
  };

  // 일정 유형에 따른 장소 카테고리를 판정한다.
  const getCategoryFromType = (type: ScheduleType): PlaceCategory => {
    // 유형별 기본 카테고리를 매핑하여 반환한다.
    if (type === 'STAY') return 'stay';
    if (type === 'TRANSPORT') return 'activity';
    if (type === 'RESERVATION') return 'activity';
    return 'sightseeing';
  };

  // 작성된 일정을 제출하고 저장한다.
  const handleSubmit = () => {
    // 제목 입력 여부를 유효성 검사한다.
    if (!title.trim()) {
      Alert.alert('알림', '일정 제목 또는 장소명을 입력해 주세요.');
      return;
    }

    // 금액 숫자를 파싱한다.
    const parsedCost = costInput.trim()
      ? Number(costInput.replace(/,/g, ''))
      : 0;

    // 상위 콜백을 호출하여 일정을 추가한다.
    onAddSchedule({
      type: selectedType,
      title: title.trim(),
      timeSlot: timeSlot.trim() || '12:00',
      estimatedCost: isNaN(parsedCost) ? 0 : parsedCost,
      memo: memo.trim(),
      placeCategory: getCategoryFromType(selectedType),
      transitInfo: transitInfo.trim() || undefined,
    });

    // 폼을 닫고 초기화한다.
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* 헤더 바 */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>DAY {dayNumber}</Text>
              </View>
              <Text style={styles.headerTitle}>Quick Add 일정 추가</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {tripTitle}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 섹션 1: 일정 유형 선택 그리드 */}
            <Text style={styles.sectionTitle}>어떤 일정을 추가할까요?</Text>
            <View style={styles.typeGrid}>
              {scheduleTypeOptions.map((opt) => {
                const isSelected = selectedType === opt.type;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[
                      styles.typeCard,
                      isSelected && styles.typeCardActive,
                    ]}
                    onPress={() => setSelectedType(opt.type)}
                  >
                    <View
                      style={[
                        styles.typeIconWrap,
                        isSelected && styles.typeIconWrapActive,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={20}
                        color={isSelected ? colors.primary : colors.muted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.typeLabel,
                        isSelected && styles.typeLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={styles.typeSubLabel} numberOfLines={1}>
                      {opt.subLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 섹션 2: 장소명 및 제목 입력 */}
            <Text style={styles.sectionTitle}>
              {selectedType === 'PLACE'
                ? '장소명 / 상호'
                : selectedType === 'TRANSPORT'
                  ? '이동 노선 / 수단'
                  : selectedType === 'STAY'
                    ? '숙소 명칭'
                    : selectedType === 'RESERVATION'
                      ? '예약 항목'
                      : '메모 제목'}
            </Text>
            <View style={styles.searchBarWrap}>
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.mutedLight}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  selectedType === 'PLACE'
                    ? '예: 시라하마 해변, 해물 라멘집'
                    : selectedType === 'TRANSPORT'
                      ? '예: JR 특급 쿠로시오 열차 (1시간 20분)'
                      : selectedType === 'STAY'
                        ? '예: 호텔 힐사이드 와카야마'
                        : selectedType === 'RESERVATION'
                          ? '예: 노천 온천 18:00 예약'
                          : '메모할 제목을 입력하세요'
                }
                placeholderTextColor={colors.mutedLight}
                value={title}
                onChangeText={setTitle}
              />
              {title.length > 0 && (
                <TouchableOpacity onPress={() => setTitle('')}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={colors.mutedLight}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* 섹션 3: 세부 일정 정보 (시간, 비용, 메모) */}
            <Text style={styles.sectionTitle}>세부 일정 정보</Text>
            <View style={styles.formCard}>
              {/* 방문/이용 예정 시간 */}
              <View style={styles.inputRow}>
                <View style={styles.inputLabelWrap}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.muted}
                  />
                  <Text style={styles.inputLabel}>예정 시간</Text>
                </View>
                <TextInput
                  style={styles.timeInput}
                  placeholder="예: 10:30"
                  placeholderTextColor={colors.mutedLight}
                  value={timeSlot}
                  onChangeText={setTimeSlot}
                />
              </View>

              {/* 예상 경비 */}
              <View style={styles.inputRow}>
                <View style={styles.inputLabelWrap}>
                  <Ionicons
                    name="wallet-outline"
                    size={16}
                    color={colors.muted}
                  />
                  <Text style={styles.inputLabel}>예상 경비</Text>
                </View>
                <TextInput
                  style={styles.costInput}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={colors.mutedLight}
                  value={costInput}
                  onChangeText={setCostInput}
                />
              </View>

              {/* 이동 안내 (선택 입력) */}
              <View style={styles.inputBlock}>
                <View style={styles.inputLabelWrap}>
                  <Ionicons
                    name="navigate-outline"
                    size={16}
                    color={colors.secondary}
                  />
                  <Text style={styles.inputLabel}>
                    다음 지점 이동 안내 (선택)
                  </Text>
                </View>
                <TextInput
                  style={styles.textInputFull}
                  placeholder="예: 버스 10분 이동 / 도보 5분"
                  placeholderTextColor={colors.mutedLight}
                  value={transitInfo}
                  onChangeText={setTransitInfo}
                />
              </View>

              {/* 메모 & 꿀팁 */}
              <View style={styles.inputBlock}>
                <View style={styles.inputLabelWrap}>
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={colors.muted}
                  />
                  <Text style={styles.inputLabel}>일정 메모 & 팁</Text>
                </View>
                <TextInput
                  style={[styles.textInputFull, styles.memoInput]}
                  placeholder="사진 스팟, 챙길 것, 예약 번호 등 자유 메모"
                  placeholderTextColor={colors.mutedLight}
                  multiline
                  numberOfLines={3}
                  value={memo}
                  onChangeText={setMemo}
                />
              </View>
            </View>
          </ScrollView>

          {/* 하단 CTA 버튼 */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color={colors.textLight} />
              <Text style={styles.submitBtnText}>+ 일정에 추가하기</Text>
            </TouchableOpacity>
            <Text style={styles.footerNotice}>
              추가된 일정은 타임라인 및 지도에 실시간 동기화됩니다.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// QuickAddModal 컴포넌트의 스타일을 정의한다.
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitleWrap: {
    flex: 1,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  sheetBody: {
    maxHeight: 520,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeCard: {
    width: '31%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  typeIconWrapActive: {
    backgroundColor: colors.surface,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  typeLabelActive: {
    color: colors.primary,
  },
  typeSubLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  formCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputBlock: {
    gap: 6,
  },
  inputLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  timeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    width: 100,
    textAlign: 'center',
  },
  costInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    width: 120,
    textAlign: 'right',
  },
  textInputFull: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  memoInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  submitBtn: {
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
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textLight,
  },
  footerNotice: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
});
