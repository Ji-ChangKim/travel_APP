import Modal from '@/components/AppModal';
import { useState } from 'react';
import {
  Alert,
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
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';

import { colors } from '@/constants/theme';
import { updateUserProfile } from '@/services/profileService';
import { useTripStore } from '@/stores/useTripStore';
import { serverOptions } from '@/features/workspace/service';
import { Action } from '@/features/workspace/ui';
import { useAuthReady } from '@/features/auth/AuthBridge';
import TripPrintLoading from '@/components/TripPrintLoading';

// 여행 스타일 선택 옵션 목록을 정의한다.
const TRAVEL_STYLE_OPTIONS = [
  '휴양/힐링',
  '미식/맛집',
  '액티비티',
  '자연/풍경',
  '쇼핑',
  '문화/역사',
  '인스타감성',
  '배낭여행',
];

// [마이] 프로필 및 앱 환경 설정 화면을 렌더링한다.
export default function MyScreen() {
  // 탭 경로를 유지한 채 실제 인증 상태가 확정된 뒤 개인 화면을 표시한다.
  return useAuthReady((state) => {
    // 정적 렌더와 첫 클라이언트 렌더에서 같은 준비 화면을 사용한다.
    return state.ready;
  }) ? (
    <MyContent />
  ) : (
    <TripPrintLoading message="계정을 확인하고 있어요" />
  );
}

// 확인된 계정의 프로필과 여행 통계를 표시한다.
function MyContent() {
  const router = useRouter();
  const { trips, visits, currentUser, updateProfile, logout } = useTripStore();

  // 활동 통계도 내 여행과 동일한 계정별 서버 원본을 조회한다.
  const userId = currentUser?.id || '';
  const serverTrips = useQuery({
    queryKey: foundationQueryKey(userId || '', 'trips'),
    enabled: Boolean(userId),
    queryFn: () => {
      // 게스트의 기기 초안을 계정의 여행 통계에 합산하지 않는다.
      return serverOptions(userId!).then(listServerTrips);
    },
    retry: false,
  });

  // 프로필 편집 모달 및 폼 상태를 관리한다.
  const [isProfileEditModalOpen, setIsProfileEditModalOpen] =
    useState<boolean>(false);
  const [editNickname, setEditNickname] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [editTravelStyles, setEditTravelStyles] = useState<string[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // 프로필 수정 모달을 열고 현재 데이터를 폼 상태에 채운다.
  const openProfileEditModal = () => {
    setEditNickname(currentUser?.nickname || '');
    setEditBio(currentUser?.bio || '');
    setEditTravelStyles(currentUser?.travelStyles || []);
    setIsProfileEditModalOpen(true);
  };

  // 프로필 수정 모달을 닫는다.
  const closeProfileEditModal = () => {
    setIsProfileEditModalOpen(false);
  };

  // 여행 스타일 태그 선택을 토글한다.
  const handleToggleTravelStyle = (tag: string) => {
    setEditTravelStyles((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // 프로필 정보 수정을 서버 및 스토어에 반영한다.
  const handleSaveProfile = () => {
    // 실제 서버 저장이 끝나야 완료 안내를 표시한다.
    return !editNickname.trim() || !currentUser
      ? Alert.alert('알림', '로그인과 닉네임을 확인해 주세요.')
      : (setIsSavingProfile(true),
        updateUserProfile(currentUser.id, {
          nickname: editNickname.trim(),
          bio: editBio.trim() || null,
          travelStyles: editTravelStyles,
        })
          .then((profile) => {
            // 서버 확정 결과를 반영하고 편집 화면을 닫는다.
            return (
              updateProfile(profile),
              setIsProfileEditModalOpen(false),
              Alert.alert('저장 완료', '프로필을 저장했습니다.')
            );
          })
          .catch(() => {
            // 실패한 입력은 유지하고 재시도를 안내한다.
            return Alert.alert(
              '저장 실패',
              '연결이 끊겼어요. 잠시 후 다시 시도해 주세요.',
            );
          })
          .finally(() => {
            // 다시 저장할 수 있게 잠금을 해제한다.
            return setIsSavingProfile(false);
          }));
  };

  // 계정 로그아웃 알림을 표시한다.
  const handleLogout = () => {
    // 로그아웃 확인 창을 표시한다.
    Alert.alert('로그아웃', '현재 계정에서 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          // 실제 세션 종료가 완료된 경우에만 로그인 화면으로 이동한다.
          logout()
            .then(() => {
              // 로그아웃 이후의 계정 화면을 닫는다.
              router.replace('/login');
            })
            .catch(() => {
              // 세션 종료 실패를 성공으로 안내하지 않는다.
              Alert.alert('로그아웃 실패', '잠시 후 다시 시도해 주세요.');
            });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 상단 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>계정 및 환경</Text>
          <Text style={styles.headerTitle}>마이페이지</Text>
        </View>

        {/* 사용자 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(currentUser?.nickname || '나')[0]}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>
                  {currentUser?.nickname || '여행자'}
                </Text>
                <View style={styles.authBadge}>
                  <Text style={styles.authBadgeText}>
                    {currentUser?.authProvider === 'guest'
                      ? '게스트'
                      : '내 계정'}
                  </Text>
                </View>
              </View>
              <Text style={styles.userEmail}>
                {currentUser?.authProvider === 'guest'
                  ? '계정을 연결하면 다른 기기에서도 이어갈 수 있어요'
                  : userId
                    ? '여행과 기록을 계정에 보관합니다'
                    : '로그인 전 둘러보기 중입니다'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={openProfileEditModal}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={14} color={colors.accent} />
              <Text style={styles.editProfileBtnText}>수정</Text>
            </TouchableOpacity>
          </View>

          {/* 한 줄 자기소개 */}
          {currentUser?.bio ? (
            <View style={styles.bioContainer}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color={colors.muted}
              />
              <Text style={styles.bioText}>{currentUser.bio}</Text>
            </View>
          ) : null}

          {/* 선호 여행 스타일 태그 목록 */}
          {currentUser?.travelStyles && currentUser.travelStyles.length > 0 ? (
            <View style={styles.travelStylesWrap}>
              {currentUser.travelStyles.map((style) => (
                <View key={style} style={styles.travelStyleChip}>
                  <Text style={styles.travelStyleChipText}>#{style}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {currentUser?.authProvider === 'guest' && (
          <View style={styles.card}>
            <Text style={styles.settingTitle}>
              게스트 여행을 내 계정에 연결하기
            </Text>
            <Text style={styles.settingDesc}>
              지금 저장한 일정과 사진을 그대로 이어가세요. 계정을 연결하기
              전에는 앱 삭제나 로그아웃 시 게스트 계정을 다시 찾을 수 없어요.
            </Text>
            <Action
              label="계정 연결하기"
              variant="primary"
              onPress={() => {
                // 게스트 세션을 유지한 채 실제 계정 인증을 시작한다.
                return router.push('/login');
              }}
            />
          </View>
        )}

        {/* 여행 활동 통계 요약 */}
        {userId ? (
          <View style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>
                {serverTrips.isSuccess ? serverTrips.data.length : '—'}
              </Text>
              <Text style={styles.summaryText}>총 여행</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>
                {serverTrips.isSuccess
                  ? serverTrips.data.filter((trip) => {
                      // 앞으로 떠날 여행만 예정 통계에 포함한다.
                      return (
                        trip.status === 'PLANNED' || trip.status === 'DRAFT'
                      );
                    }).length
                  : '—'}
              </Text>
              <Text style={styles.summaryText}>예정된 여행</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>
                {serverTrips.isSuccess
                  ? serverTrips.data.filter((trip) => {
                      // 발자국 목록과 동일하게 완료 여행만 집계한다.
                      return trip.status === 'COMPLETED';
                    }).length
                  : '—'}
              </Text>
              <Text style={styles.summaryText}>완성된 발자국</Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.settingTitle}>나의 여행을 한곳에</Text>
            <Text style={styles.settingDesc}>
              로그인하면 여행 계획을 저장하고 친구와 함께 작성할 수 있어요.
            </Text>
            <Action
              label="로그인 / 회원가입"
              variant="primary"
              onPress={() => {
                // 실제 계정 인증 화면으로 이동한다.
                return router.push('/login');
              }}
            />
          </View>
        )}
        {userId && serverTrips.isError && (
          <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.settingDesc}>
              여행 통계를 불러오지 못했어요. 다시 시도해 주세요.
            </Text>
            <Action
              label="여행 통계 다시 불러오기"
              onPress={() => {
                // 실패한 계정 통계 요청만 다시 실행한다.
                return void serverTrips.refetch();
              }}
            />
          </View>
        )}
        {userId && serverTrips.isPending && (
          <Text style={styles.settingDesc}>나의 여행을 불러오고 있어요.</Text>
        )}

        {/* 사용자가 확인할 앱 버전만 표시한다. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>앱 버전</Text>
              <Text style={styles.infoValue}>v0.1.0</Text>
            </View>
            {(trips.length > 0 || visits.length > 0) && (
              <Action
                label="이 기기에 저장한 이전 기록 보기"
                onPress={() => {
                  // 기존 기기 기록이 실제로 있는 경우에만 보존 화면을 제공한다.
                  return router.push('/local-records');
                }}
              />
            )}
          </View>
        </View>

        {/* 로그아웃 버튼 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutBtnText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 개인 프로필 수정 모달 */}
      <Modal visible={isProfileEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>개인 프로필 수정</Text>
              <TouchableOpacity onPress={closeProfileEditModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              나만의 프로필과 여행 성향을 설정하여 동행자에게 공유해 보세요.
            </Text>

            {/* 닉네임 입력 */}
            <View style={styles.editInputGroup}>
              <Text style={styles.editInputLabel}>닉네임</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editNickname}
                onChangeText={setEditNickname}
                placeholder="닉네임 입력"
                placeholderTextColor={colors.mutedLight}
                maxLength={20}
              />
            </View>

            {/* 한 줄 소개 입력 */}
            <View style={styles.editInputGroup}>
              <Text style={styles.editInputLabel}>한 줄 소개 (소개글)</Text>
              <TextInput
                style={[styles.modalTextInput, styles.bioInput]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="예: 힐링과 맛집 탐방을 사랑하는 여행자입니다 :)"
                placeholderTextColor={colors.mutedLight}
                multiline
                numberOfLines={2}
                maxLength={80}
              />
            </View>

            {/* 여행 스타일 태그 선택 */}
            <View style={styles.editInputGroup}>
              <Text style={styles.editInputLabel}>
                나의 여행 스타일 (다중 선택)
              </Text>
              <View style={styles.tagSelectWrap}>
                {TRAVEL_STYLE_OPTIONS.map((tag) => {
                  const isSelected = editTravelStyles.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.tagOptionChip,
                        isSelected && styles.tagOptionChipActive,
                      ]}
                      onPress={() => handleToggleTravelStyle(tag)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.tagOptionText,
                          isSelected && styles.tagOptionTextActive,
                        ]}
                      >
                        {isSelected ? '✓ ' : ''}
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 저장 CTA 버튼 */}
            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              activeOpacity={0.85}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.modalSubmitBtnText}>
                {isSavingProfile ? '저장 중...' : '프로필 저장하기'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 마이페이지 화면 스타일 규격
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.textLight },
  profileInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 17, fontWeight: '800', color: colors.text },
  authBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  authBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  userEmail: { fontSize: 12, color: colors.muted },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  bioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bioText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  travelStylesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  travelStyleChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  travelStyleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryNum: { fontSize: 20, fontWeight: '800', color: colors.primary },
  summaryText: { fontSize: 11, color: colors.muted, marginTop: 2 },
  summaryDivider: { width: 1, height: 24, backgroundColor: colors.border },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingTextGroup: { flex: 1, paddingRight: 12 },
  settingTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  settingDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 4,
  },
  logoutBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalDesc: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  editInputGroup: { gap: 6 },
  editInputLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  modalTextInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.background,
    color: colors.text,
  },
  bioInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  tagSelectWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tagOptionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  tagOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  tagOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    marginTop: 6,
  },
  modalSubmitBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
});
