import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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
import type { ItineraryItem } from '@wherego/domain';
import { tripCreateSchema } from '@wherego/validation';

// 통화 기본 정보 인터페이스를 정의한다.
interface CurrencyInfo {
  symbol: string;
  code: string;
  name: string;
  rateText: string;
}

// 목적지 프리셋 인터페이스를 정의한다.
interface DestinationPreset {
  country: string;
  city: string;
  region: string;
  isPopular?: boolean;
}

// 추천 인기 여행지 목록을 정의한다.
const POPULAR_DESTINATIONS: DestinationPreset[] = [
  {
    country: '일본',
    city: '도쿄',
    region: '간토 지방 · 아시아',
    isPopular: true,
  },
  {
    country: '일본',
    city: '오사카',
    region: '간사이 지방 · 아시아',
    isPopular: true,
  },
  {
    country: '일본',
    city: '후쿠오카',
    region: '규슈 지방 · 아시아',
    isPopular: true,
  },
  {
    country: '대한민국',
    city: '제주',
    region: '제주도 · 대한민국',
    isPopular: true,
  },
  {
    country: '프랑스',
    city: '파리',
    region: '일드프랑스 · 유럽',
    isPopular: false,
  },
  {
    country: '베트남',
    city: '다낭',
    region: '중부 지방 · 동남아시아',
    isPopular: true,
  },
];

// 도시별 테마 여행 추천 제목 목록을 정의한다.
const RECOMMENDED_TITLES: Record<string, string[]> = {
  도쿄: [
    '도쿄 휴식 & 디즈니 투어',
    '도쿄 감성 카페 & 쇼핑 로드',
    '시부야 & 아사쿠사 완전 정복',
    '도쿄 미식 탐방과 신주쿠 야경',
  ],
  오사카: [
    '오사카 식도락 & 유니버설 스튜디오',
    '교토·오사카 힐링 온천 산책',
    '오사카 골목 숨은 맛집 기행',
  ],
  제주: [
    '제주 바다와 오션뷰 드라이브',
    '제주 푸른 숲길과 감성 카페',
    '제주 올레길 힐링 트레킹',
  ],
};

// 날짜 문자열을 한국어 요일이 포함된 형식으로 변환한다.
function formatDateWithDay(dateString: string): string {
  // 유효하지 않은 날짜인 경우 원본 문자열을 그대로 반환한다.
  if (!dateString || isNaN(new Date(dateString).getTime())) return dateString;
  const dateObj = new Date(dateString);
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const weekday = weekdayNames[dateObj.getDay()] || '';
  return `${year}.${month}.${day}(${weekday})`;
}

// 시작일과 종료일 사이의 숙박 수와 총 여행 일수를 계산한다.
function calculateNightAndDay(startDate: string, endDate: string): string {
  // 시작일과 종료일 타임스탬프의 차이로 일수 차이를 계산한다.
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (isNaN(start) || isNaN(end) || end < start) {
    return '1일 일정';
  }
  const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  return `총 ${diffDays}박 ${diffDays + 1}일`;
}

// 출발일까지 남은 D-Day 문자열을 계산한다.
function calculateDDay(startDate: string): string {
  // 오늘 날짜와 출발일의 일수 차이를 계산하여 D-Day 안내 문구를 생성한다.
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const target = new Date(startDate).getTime();
  if (isNaN(target)) return '';
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `출발 ${diffDays}일 전`;
  if (diffDays === 0) return '오늘 출발!';
  return `출발 ${Math.abs(diffDays)}일 경과`;
}

// 특정 도시에 어울리는 추천 여행 제목을 무작위로 추출한다.
function getRandomThemeTitle(city: string, currentTitle: string): string {
  // 해당 도시의 추천 제목 목록을 가져온다.
  const pool = RECOMMENDED_TITLES[city] || [
    `${city} 힐링 & 명소 산책`,
    `${city} 미식 투어와 도심 탐방`,
    `${city} 감성 포토스팟 로드`,
  ];
  const candidates = pool.filter((title) => title !== currentTitle);
  const selectedIndex = Math.floor(Math.random() * candidates.length);
  return candidates[selectedIndex] || pool[0] || `${city} 여행`;
}

// 국가 명칭에 부합하는 기준 통화 및 실시간 환율 정보를 조회한다.
function getDefaultCurrencyInfo(country: string): CurrencyInfo {
  // 국가명에 따라 통화 기호, 코드, 안내 환율 텍스트를 반환한다.
  if (country === '일본') {
    return {
      symbol: '¥',
      code: 'JPY',
      name: '일본 엔화',
      rateText: '100엔 = 920.40원',
    };
  }
  if (country === '프랑스' || country === '유럽') {
    return {
      symbol: '€',
      code: 'EUR',
      name: '유럽 유로',
      rateText: '1유로 = 1,480.20원',
    };
  }
  if (country === '미국') {
    return {
      symbol: '$',
      code: 'USD',
      name: '미국 달러',
      rateText: '1달러 = 1,350.50원',
    };
  }
  return {
    symbol: '₩',
    code: 'KRW',
    name: '대한민국 원화',
    rateText: '기준 통화 (1:1 적용)',
  };
}

// 항공권 토글 활성화 시 DAY 1에 자동 배치할 초기 일정 목록을 생성한다.
function createInitialFlightSchedules(): Omit<
  ItineraryItem,
  'id' | 'createdAt'
>[] {
  // 도착 공항 수속, 특급 이동 수단, 호텔 체크인 세 가지 기본 일정을 반환한다.
  return [
    {
      tripDayId: 'day-1',
      placeId: `place-auto-1`,
      timeSlot: '12:45',
      sortOrder: 1,
      memo: '대한항공 KE703 편으로 나리타 공항 제1터미널 도착 및 입국 수속 진행',
      place: {
        id: `place-auto-1`,
        name: '나리타 국제공항 제1터미널',
        category: 'sightseeing',
        createdAt: new Date().toISOString(),
      },
    },
    {
      tripDayId: 'day-1',
      placeId: `place-auto-2`,
      timeSlot: '13:45',
      sortOrder: 2,
      memo: '나리타 익스프레스(N-EX) 탑승 후 신주쿠 방면으로 이동 (약 1시간 20분 소요)',
      place: {
        id: `place-auto-2`,
        name: '나리타 익스프레스 (N-EX)',
        category: 'activity',
        createdAt: new Date().toISOString(),
      },
    },
    {
      tripDayId: 'day-1',
      placeId: `place-auto-3`,
      timeSlot: '15:30',
      sortOrder: 3,
      memo: '신주쿠 숙소 도착 후 체크인 및 짐 보관, 가벼운 외출 준비',
      place: {
        id: `place-auto-3`,
        name: '신주쿠 메인 호텔',
        category: 'stay',
        createdAt: new Date().toISOString(),
      },
    },
  ];
}

// Stitch 목업 기반 일정 사전 계획 생성(Plan Create) 화면 컴포넌트
export default function PlanCreateScreen() {
  const router = useRouter();
  const { createTrip, addItineraryItem } = useTripStore();

  // 기본 상태 관리
  const [selectedDestination, setSelectedDestination] =
    useState<DestinationPreset>(
      POPULAR_DESTINATIONS[0] || {
        country: '일본',
        city: '도쿄',
        region: '간토 지방 · 아시아',
      },
    );
  const [startDate, setStartDate] = useState('2025-05-16');
  const [endDate, setEndDate] = useState('2025-05-19');
  const [tripTitle, setTripTitle] = useState('도쿄 휴식 & 디즈니 투어');
  const [isFlightAutoSyncEnabled, setIsFlightAutoSyncEnabled] = useState(true);

  // 모달 제어 상태
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  // 통화 및 날짜 요약 계산
  const currencyInfo = getDefaultCurrencyInfo(selectedDestination.country);
  const scheduleDurationText = calculateNightAndDay(startDate, endDate);
  const dDayText = calculateDDay(startDate);

  // 이전 화면으로 복귀한다.
  const handleNavigateBack = () => {
    // router.back()을 호출하여 현재 화면을 종료한다.
    router.back();
  };

  // 새로운 목적지를 선택하여 상태에 반영한다.
  const handleSelectDestination = (item: DestinationPreset) => {
    // 선택된 목적지 상태를 갱신하고 연관 추천 제목을 자동 세팅한다.
    setSelectedDestination(item);
    setTripTitle(getRandomThemeTitle(item.city, ''));
    setIsDestinationModalOpen(false);
  };

  // 여행 제목 새로고침 버튼 클릭 시 추천 테마를 재설정한다.
  const handleRefreshTitle = () => {
    // 현재 도시에 해당하는 새로운 추천 제목을 받아와 갱신한다.
    const newTitle = getRandomThemeTitle(selectedDestination.city, tripTitle);
    setTripTitle(newTitle);
  };

  // 날짜 설정 모달에서 선택을 확정한다.
  const handleConfirmDates = () => {
    // 임시 저장된 날짜를 실제 여행 일정 상태에 적용한다.
    if (new Date(tempEndDate).getTime() < new Date(tempStartDate).getTime()) {
      Alert.alert('알림', '종료일은 시작일보다 빠를 수 없습니다.');
      return;
    }
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setIsDateModalOpen(false);
  };

  // 동행자 초대 링크를 복사한다.
  const handleCopyInviteLink = () => {
    // 동행 초대 링크 복사 알림 팝업을 표시한다.
    Alert.alert(
      '초대 링크 생성 완료',
      `'${tripTitle}' 여행의 동행자 초대 링크가 생성되었습니다.\n친구에게 링크를 전달하면 함께 일정을 조율할 수 있습니다.`,
    );
  };

  // 입력값을 검증하고 새로운 여행 및 자동 배정 일정을 생성한다.
  const handleCreatePlan = () => {
    // Zod 스키마를 통해 필수 입력값을 검증한다.
    const tripInput = {
      title: tripTitle.trim() || `${selectedDestination.city} 여행`,
      country: selectedDestination.country,
      city: selectedDestination.city,
      startDate: startDate,
      endDate: endDate,
      coverColor: colors.stitchCoral,
    };

    const validationResult = tripCreateSchema.safeParse(tripInput);
    if (!validationResult.success) {
      const errorMsg =
        validationResult.error.errors[0]?.message ||
        '입력 정보를 다시 확인해 주세요.';
      Alert.alert('입력 확인', errorMsg);
      return;
    }

    // 여행 스토어에 새로운 여행을 생성하고 생성된 여행 객체를 반환받는다.
    const createdTrip = createTrip({
      ...tripInput,
      status: 'PLANNED',
    });

    // 항공권 자동배치가 활성화되어 있는 경우 DAY 1 초기 일정을 자동으로 등록한다.
    if (isFlightAutoSyncEnabled && createdTrip?.id) {
      const defaultSchedules = createInitialFlightSchedules();
      defaultSchedules.forEach((item) => {
        addItineraryItem(createdTrip.id, item);
      });
    }

    // 성공 안내 후 메인 여행 화면으로 이동한다.
    Alert.alert(
      '일정 생성 완료',
      `'${tripInput.title}' 일정이 성공적으로 생성되었습니다!\nDAY 1 타임라인을 확인해 보세요.`,
      [
        {
          text: '확인',
          onPress: () => {
            router.replace('/(tabs)');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* 1. 상단 네비게이션 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          onPress={handleNavigateBack}
          style={styles.headerIconButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.stitchSlate} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          Plan Create
        </Text>
        <TouchableOpacity
          accessibilityLabel="닫기"
          accessibilityRole="button"
          onPress={handleNavigateBack}
          style={styles.headerIconButton}
        >
          <Ionicons name="close" size={24} color={colors.stitchSlate} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. 하루 코치 안내 배너 */}
        <View style={styles.haruBanner}>
          <View style={styles.haruAvatarCircle}>
            <Ionicons name="sparkles" size={20} color={colors.textLight} />
          </View>
          <View style={styles.haruBannerTextContainer}>
            <View style={styles.haruBadge}>
              <Text style={styles.haruBadgeText}>하루(Haru) 코치</Text>
            </View>
            <Text style={styles.haruBannerDescription}>
              여행지와 날짜를 알려주시면 Day별 일정 타임라인과 최적 동선을
              자동으로 준비해 드릴게요!
            </Text>
          </View>
        </View>

        {/* 3. 여행 기본 정보 섹션 */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIndicatorBar} />
          <Text style={styles.sectionTitle}>여행 기본 정보</Text>
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredBadgeText}>필수 입력</Text>
          </View>
        </View>

        {/* 목적지 카드 */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>목적지 (국가 및 도시)</Text>
          <TouchableOpacity
            style={styles.destinationCard}
            onPress={() => setIsDestinationModalOpen(true)}
            activeOpacity={0.8}
          >
            <View style={styles.destinationImagePlaceholder}>
              <Ionicons name="business" size={26} color={colors.stitchCyan} />
            </View>
            <View style={styles.destinationInfo}>
              <View style={styles.destinationTitleRow}>
                <Text style={styles.destinationCityText}>
                  {selectedDestination.country} {selectedDestination.city}
                </Text>
                {selectedDestination.isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>주요 여행지</Text>
                  </View>
                )}
              </View>
              <Text style={styles.destinationSubText}>
                {selectedDestination.region}
              </Text>
            </View>
            <View style={styles.editCircle}>
              <Ionicons name="pencil" size={16} color={colors.stitchMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 여행 일정 카드 */}
        <View style={styles.fieldBlock}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>여행 일정</Text>
            <View style={styles.scheduleBadge}>
              <Text style={styles.scheduleBadgeText}>
                {scheduleDurationText}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.scheduleCard}
            onPress={() => {
              setTempStartDate(startDate);
              setTempEndDate(endDate);
              setIsDateModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.calendarIconCircle}>
              <Ionicons name="calendar" size={20} color={colors.stitchCyan} />
            </View>
            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleDatesText}>
                {formatDateWithDay(startDate)} ~ {formatDateWithDay(endDate)}
              </Text>
              <Text style={styles.scheduleDDayText}>{dDayText}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.stitchMuted}
            />
          </TouchableOpacity>
        </View>

        {/* 여행 제목 입력창 */}
        <View style={styles.fieldBlock}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>여행 제목 (선택)</Text>
            <View style={styles.themeBadge}>
              <Text style={styles.themeBadgeText}>추천 테마</Text>
            </View>
          </View>
          <View style={styles.titleInputContainer}>
            <TextInput
              style={styles.titleInput}
              value={tripTitle}
              onChangeText={setTripTitle}
              placeholder="여행 제목을 입력해 주세요"
              placeholderTextColor={colors.stitchMutedLight}
            />
            <TouchableOpacity
              onPress={handleRefreshTitle}
              style={styles.refreshButton}
              accessibilityLabel="추천 제목 새로고침"
            >
              <Ionicons name="refresh" size={18} color={colors.stitchMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 기준 통화 및 환율 정보 */}
        <View style={styles.currencyCard}>
          <View style={styles.currencyTopRow}>
            <Text style={styles.currencyTitle}>
              {currencyInfo.symbol} 기준 통화 : {currencyInfo.code} (
              {currencyInfo.name})
            </Text>
            <Text style={styles.currencyTag}>적용 중</Text>
          </View>
          <View style={styles.currencyBottomRow}>
            <View style={styles.rateLabelRow}>
              <Ionicons
                name="trending-up"
                size={14}
                color={colors.stitchCyan}
              />
              <Text style={styles.rateLabel}>실시간 기준 환율</Text>
            </View>
            <Text style={styles.rateValue}>{currencyInfo.rateText}</Text>
          </View>
        </View>

        {/* 4. 항공권 사전 등록 섹션 */}
        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <View
            style={[
              styles.sectionIndicatorBar,
              { backgroundColor: colors.stitchCyan },
            ]}
          />
          <Text style={styles.sectionTitle}>항공권 사전 등록</Text>
          <View style={styles.autoLinkBadge}>
            <Text style={styles.autoLinkBadgeText}>일정 자동연계</Text>
          </View>
        </View>

        {/* 항공권 등록 활성화 토글 */}
        <View style={styles.flightToggleCard}>
          <View style={styles.flightToggleIconCircle}>
            <Ionicons name="airplane" size={20} color={colors.stitchCyan} />
          </View>
          <View style={styles.flightToggleTextContainer}>
            <Text style={styles.flightToggleTitle}>
              항공편 등록 및 첫 일정 자동배치
            </Text>
            <Text style={styles.flightToggleSubtitle}>
              입국 수속과 이동 시간을 계산해요
            </Text>
          </View>
          <Switch
            value={isFlightAutoSyncEnabled}
            onValueChange={setIsFlightAutoSyncEnabled}
            trackColor={{
              false: colors.stitchBorder,
              true: colors.stitchCoral,
            }}
            thumbColor={colors.textLight}
          />
        </View>

        {/* 항공권 세부 정보 (토글 활성화 시 표시) */}
        {isFlightAutoSyncEnabled && (
          <View style={styles.flightDetailsContainer}>
            {/* 출발 항공편 카드 */}
            <View style={styles.flightCard}>
              <View style={styles.flightCardHeader}>
                <View style={styles.flightTypeBadge}>
                  <Text style={styles.flightTypeBadgeText}>출발 항공편</Text>
                </View>
                <Text style={styles.flightNumberText}>대한항공 KE703</Text>
                <View style={styles.confirmedBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.stitchCyan}
                  />
                  <Text style={styles.confirmedBadgeText}>확인됨</Text>
                </View>
              </View>

              {/* 항공 루트 다이어그램 */}
              <View style={styles.routeDiagram}>
                <View style={styles.routeAirportCol}>
                  <Text style={styles.airportCode}>ICN</Text>
                  <Text style={styles.airportName}>인천 제2터미널</Text>
                  <Text style={styles.flightTime}>10:15</Text>
                </View>

                <View style={styles.routeMidCol}>
                  <Text style={styles.flightDuration}>2시간 30분</Text>
                  <View style={styles.routeLineRow}>
                    <View style={styles.routeDot} />
                    <View style={styles.routeLine} />
                    <Ionicons
                      name="airplane"
                      size={16}
                      color={colors.stitchCoral}
                    />
                    <View style={styles.routeLine} />
                    <View style={styles.routeDot} />
                  </View>
                  <Text style={styles.flightStatus}>직항</Text>
                </View>

                <View
                  style={[styles.routeAirportCol, { alignItems: 'flex-end' }]}
                >
                  <Text style={styles.airportCode}>NRT</Text>
                  <Text style={styles.airportName}>나리타 제1터미널</Text>
                  <Text style={styles.flightTime}>12:45</Text>
                </View>
              </View>

              <View style={styles.flightFooterRow}>
                <Text style={styles.boardingDateText}>
                  탑승일: {formatDateWithDay(startDate)} (DAY 1)
                </Text>
                <TouchableOpacity
                  style={styles.changeFlightBtn}
                  onPress={() =>
                    Alert.alert(
                      '알림',
                      '실제 운항 항공편을 검색하여 변경할 수 있습니다.',
                    )
                  }
                >
                  <Text style={styles.changeFlightBtnText}>편명 변경</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 귀국편 접이식 카드 */}
            <View style={styles.returnFlightCard}>
              <Ionicons
                name="airplane-outline"
                size={18}
                color={colors.stitchMuted}
              />
              <View style={styles.returnFlightTextContainer}>
                <Text style={styles.returnFlightTitle}>
                  대한항공 KE704{' '}
                  <Text style={styles.returnBadge}>[귀국편]</Text>
                </Text>
                <Text style={styles.returnFlightTime}>
                  {formatDateWithDay(endDate)} 14:00 NRT → 16:45 ICN
                </Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.stitchMuted}
              />
            </View>

            {/* 하루 자동배치 안내문 */}
            <View style={styles.flightInsightBox}>
              <Ionicons
                name="bulb-outline"
                size={18}
                color={colors.stitchCyan}
              />
              <Text style={styles.flightInsightText}>
                비행기 도착 시간(12:45)을 기준으로 DAY 1 나리타 익스프레스 이동
                및 숙소 체크인 일정이 타임라인에 자동으로 배치됩니다.
              </Text>
            </View>
          </View>
        )}

        {/* 5. 동행자 초대 섹션 */}
        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <View
            style={[
              styles.sectionIndicatorBar,
              { backgroundColor: colors.stitchSlate },
            ]}
          />
          <Text style={styles.sectionTitle}>동행자 초대 (선택)</Text>
        </View>

        <View style={styles.companionCard}>
          <View style={styles.companionAvatarStack}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.stitchCoral },
              ]}
            >
              <Text style={styles.avatarInitial}>나</Text>
            </View>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.stitchBorder, marginLeft: -10 },
              ]}
            >
              <Ionicons
                name="person-add"
                size={14}
                color={colors.stitchMuted}
              />
            </View>
          </View>
          <View style={styles.companionInfo}>
            <Text style={styles.companionTitle}>친구와 함께 루트짜기</Text>
            <Text style={styles.companionSubtitle}>
              나중에 생성 후에도 초대 가능
            </Text>
          </View>
          <TouchableOpacity
            style={styles.copyLinkButton}
            onPress={handleCopyInviteLink}
            activeOpacity={0.8}
          >
            <Text style={styles.copyLinkButtonText}>초대 링크 복사</Text>
          </TouchableOpacity>
        </View>

        {/* 6. 스마트 템플릿 추천 카드 */}
        <View style={styles.templateCard}>
          <View style={styles.templateThumbnail}>
            <Ionicons name="map" size={24} color={colors.stitchCyan} />
          </View>
          <View style={styles.templateInfo}>
            <Text style={styles.templateBrand}>TripPrint 스마트 템플릿</Text>
            <Text style={styles.templateTitle}>
              {selectedDestination.city} 추천 코스 준비 완료
            </Text>
            <Text style={styles.templateTags}>
              도심 명소 · 감성 스팟 · 테마파크
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 7. 하단 고정 생성 버튼 (CTA) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryCtaButton}
          onPress={handleCreatePlan}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryCtaText}>
            계획 생성하고 DAY 1 일정 채우기
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.textLight} />
        </TouchableOpacity>
        <Text style={styles.bottomHelperText}>
          등록 후에도 언제든 여행 일정과 도시를 변경할 수 있어요.
        </Text>
      </View>

      {/* 목적지 선택 모달 */}
      <Modal visible={isDestinationModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>여행 목적지 선택</Text>
              <TouchableOpacity
                onPress={() => setIsDestinationModalOpen(false)}
              >
                <Ionicons name="close" size={24} color={colors.stitchSlate} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {POPULAR_DESTINATIONS.map((dest) => {
                const isSelected =
                  dest.country === selectedDestination.country &&
                  dest.city === selectedDestination.city;
                return (
                  <TouchableOpacity
                    key={`${dest.country}-${dest.city}`}
                    style={[
                      styles.destSelectItem,
                      isSelected && styles.destSelectItemActive,
                    ]}
                    onPress={() => handleSelectDestination(dest)}
                  >
                    <View style={styles.destSelectInfo}>
                      <Text
                        style={[
                          styles.destSelectCity,
                          isSelected && styles.destSelectCityActive,
                        ]}
                      >
                        {dest.country} {dest.city}
                      </Text>
                      <Text style={styles.destSelectRegion}>{dest.region}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.stitchCoral}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 일정 날짜 선택 모달 */}
      <Modal visible={isDateModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>여행 일정 설정</Text>
              <TouchableOpacity onPress={() => setIsDateModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.stitchSlate} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateInputBlock}>
              <Text style={styles.dateInputLabel}>출발일 (시작일)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={tempStartDate}
                onChangeText={setTempStartDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.dateInputBlock}>
              <Text style={styles.dateInputLabel}>도착일 (종료일)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={tempEndDate}
                onChangeText={setTempEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={handleConfirmDates}
            >
              <Text style={styles.modalConfirmBtnText}>일정 적용하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Stitch 디자인 시스템에 맞춘 프리미엄 스타일시트
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.stitchBg,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.stitchBg,
  },
  headerIconButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  haruBanner: {
    flexDirection: 'row',
    backgroundColor: colors.stitchCoralSoft,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  haruAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.stitchCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haruBannerTextContainer: {
    flex: 1,
    gap: 4,
  },
  haruBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.stitchCoral,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  haruBadgeText: {
    color: colors.textLight,
    fontSize: 11,
    fontWeight: '700',
  },
  haruBannerDescription: {
    color: colors.stitchSlate,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionIndicatorBar: {
    width: 4,
    height: 16,
    backgroundColor: colors.stitchCoral,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  requiredBadge: {
    backgroundColor: colors.stitchCoralSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadgeText: {
    color: colors.stitchCoral,
    fontSize: 11,
    fontWeight: '600',
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.stitchSlate,
    marginBottom: 8,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  destinationImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.stitchCyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationInfo: {
    flex: 1,
  },
  destinationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destinationCityText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  popularBadge: {
    backgroundColor: colors.stitchCoralSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: colors.stitchCoral,
    fontSize: 10,
    fontWeight: '600',
  },
  destinationSubText: {
    fontSize: 12,
    color: colors.stitchMuted,
    marginTop: 2,
  },
  editCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.stitchBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleBadge: {
    backgroundColor: colors.stitchCyanSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scheduleBadgeText: {
    color: colors.stitchCyan,
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  calendarIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.stitchCyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleDatesText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  scheduleDDayText: {
    fontSize: 12,
    color: colors.stitchCyan,
    fontWeight: '600',
    marginTop: 2,
  },
  themeBadge: {
    backgroundColor: colors.stitchBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  themeBadgeText: {
    color: colors.stitchMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  titleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
  },
  titleInput: {
    flex: 1,
    fontSize: 14,
    color: colors.stitchSlate,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 6,
  },
  currencyCard: {
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  currencyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currencyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  currencyTag: {
    fontSize: 11,
    color: colors.stitchCoral,
    fontWeight: '600',
  },
  currencyBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.stitchBorder,
  },
  rateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rateLabel: {
    fontSize: 12,
    color: colors.stitchMuted,
  },
  rateValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  autoLinkBadge: {
    backgroundColor: colors.stitchCyanSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoLinkBadgeText: {
    color: colors.stitchCyan,
    fontSize: 11,
    fontWeight: '600',
  },
  flightToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  flightToggleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.stitchCyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightToggleTextContainer: {
    flex: 1,
  },
  flightToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  flightToggleSubtitle: {
    fontSize: 11,
    color: colors.stitchMuted,
    marginTop: 2,
  },
  flightDetailsContainer: {
    gap: 12,
  },
  flightCard: {
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  flightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flightTypeBadge: {
    backgroundColor: colors.stitchCoralSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flightTypeBadgeText: {
    color: colors.stitchCoral,
    fontSize: 11,
    fontWeight: '700',
  },
  flightNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.stitchSlate,
    flex: 1,
    marginLeft: 8,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confirmedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.stitchCyan,
  },
  routeDiagram: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  routeAirportCol: {
    width: 90,
  },
  airportCode: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.stitchSlate,
  },
  airportName: {
    fontSize: 11,
    color: colors.stitchMuted,
    marginTop: 2,
  },
  flightTime: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.stitchCoral,
    marginTop: 4,
  },
  routeMidCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  flightDuration: {
    fontSize: 11,
    color: colors.stitchMuted,
    fontWeight: '600',
  },
  routeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.stitchCoral,
  },
  routeLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.stitchBorder,
  },
  flightStatus: {
    fontSize: 11,
    color: colors.stitchMuted,
  },
  flightFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.stitchBorder,
  },
  boardingDateText: {
    fontSize: 12,
    color: colors.stitchMuted,
    fontWeight: '500',
  },
  changeFlightBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.stitchBg,
    borderRadius: 6,
  },
  changeFlightBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.stitchSlate,
  },
  returnFlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  returnFlightTextContainer: {
    flex: 1,
  },
  returnFlightTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  returnBadge: {
    fontSize: 11,
    color: colors.stitchMuted,
    fontWeight: '500',
  },
  returnFlightTime: {
    fontSize: 11,
    color: colors.stitchMuted,
    marginTop: 2,
  },
  flightInsightBox: {
    flexDirection: 'row',
    backgroundColor: colors.stitchCyanSoft,
    padding: 14,
    borderRadius: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  flightInsightText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.stitchSlate,
    fontWeight: '500',
  },
  companionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  companionAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '700',
  },
  companionInfo: {
    flex: 1,
  },
  companionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  companionSubtitle: {
    fontSize: 11,
    color: colors.stitchMuted,
    marginTop: 2,
  },
  copyLinkButton: {
    backgroundColor: colors.stitchBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyLinkButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.stitchSlate,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.stitchCard,
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  templateThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.stitchCyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateBrand: {
    fontSize: 11,
    color: colors.stitchCoral,
    fontWeight: '700',
  },
  templateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.stitchSlate,
    marginTop: 2,
  },
  templateTags: {
    fontSize: 11,
    color: colors.stitchMuted,
    marginTop: 2,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.stitchBg,
    borderTopWidth: 1,
    borderTopColor: colors.stitchBorder,
    alignItems: 'center',
    gap: 8,
  },
  primaryCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stitchCoral,
    width: '100%',
    height: 52,
    borderRadius: 26,
    gap: 8,
    shadowColor: colors.stitchCoral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryCtaText: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: '700',
  },
  bottomHelperText: {
    fontSize: 11,
    color: colors.stitchMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.stitchCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.stitchSlate,
  },
  modalScroll: {
    marginBottom: 20,
  },
  destSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.stitchBorder,
  },
  destSelectItemActive: {
    backgroundColor: colors.stitchCoralSoft,
  },
  destSelectInfo: {
    flex: 1,
  },
  destSelectCity: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.stitchSlate,
  },
  destSelectCityActive: {
    color: colors.stitchCoral,
    fontWeight: '700',
  },
  destSelectRegion: {
    fontSize: 12,
    color: colors.stitchMuted,
    marginTop: 2,
  },
  dateInputBlock: {
    marginBottom: 16,
  },
  dateInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.stitchSlate,
    marginBottom: 6,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: colors.stitchBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: colors.stitchSlate,
  },
  modalConfirmBtn: {
    backgroundColor: colors.stitchCoral,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalConfirmBtnText: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: '700',
  },
});
