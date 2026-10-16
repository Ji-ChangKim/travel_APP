import ModalBackground from '@/features/accessibility/ModalBackground';
import TextInput from '@/components/DesignInput';
import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import DesignButton from '@/components/DesignButton';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import Modal from '@/components/AppModal';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { foundationQueryKey, listServerTrips } from '@wherego/api-client';
import {
  nicknameHint,
  nicknameError,
  validProfileNickname,
} from '@wherego/validation';

import { colors } from '@/constants/theme';
import { updateUserProfile } from '@/services/profileService';
import { useTripStore } from '@/stores/useTripStore';
import { serverOptions } from '@/features/workspace/service';
import { Action } from '@/features/workspace/ui';
import { useAuthReady } from '@/features/auth/AuthBridge';
import TripPrintLoading from '@/components/TripPrintLoading';
import { tripPhase } from '@/features/workspace/tripLifecycle';
import { useTripDateRefresh } from '@/features/workspace/useTripDateRefresh';
import {
  requestScheduleExit,
  useScheduleExitGuard,
} from '@/features/workspace/scheduleExitGuard';
import {
  saveScopedProfile,
  connectProfileSaveScope,
  type ProfileSaveScope,
} from '@/features/auth/profileSave';

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
    <MyAccount />
  ) : (
    <TripPrintLoading message="계정을 확인하고 있어요" />
  );
}

// 계정이 바뀌면 이전 프로필 폼과 저장 수명을 함께 해제한다.
function MyAccount() {
  // 같은 계정의 프로필 갱신에서는 작성 화면을 유지한다.
  return (
    <MyContent
      key={useTripStore((state) => {
        // 로그아웃도 별도 화면 수명으로 분리한다.
        return state.currentUser?.id || 'signed-out';
      })}
    />
  );
}

// 확인된 계정의 프로필과 여행 통계를 표시한다.
function MyContent() {
  // 예정 여행 통계도 현지 날짜 경계와 전경 복귀에서 함께 갱신한다.
  useTripDateRefresh();
  const router = useRouter();
  const { largeText } = useAppAccessibility();
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
  const profileSave = useRef<ProfileSaveScope>({
    accountId: userId,
    active: true,
    sequence: 0,
    running: false,
  });
  useScheduleExitGuard(
    isProfileEditModalOpen
      ? {
          kind: 'profile',
          id: userId,
          values: {
            nickname: editNickname,
            bio: editBio,
            travelStyles: editTravelStyles,
          },
        }
      : null,
    isSavingProfile,
    () => {
      // 버리기를 선택한 프로필 폼만 닫는다.
      return setIsProfileEditModalOpen(false);
    },
  );
  useEffect(() => {
    // 개발 모드의 효과 재연결도 새 요청 수명으로 구분한다.
    return connectProfileSaveScope(profileSave.current);
  }, []);

  // 프로필 수정 모달을 열고 현재 데이터를 폼 상태에 채운다.
  const openProfileEditModal = () => {
    // 저장 중에는 같은 계정의 다른 편집 폼을 열지 않는다.
    return profileSave.current.running
      ? undefined
      : void (setEditNickname(currentUser?.nickname || ''),
        setEditBio(currentUser?.bio || ''),
        setEditTravelStyles(currentUser?.travelStyles || []),
        setIsProfileEditModalOpen(true));
  };

  // 프로필 수정 모달을 닫는다.
  const closeProfileEditModal = () => {
    // 응답을 기다리는 동안 닫기로 요청 수명을 잃지 않는다.
    return profileSave.current.running
      ? undefined
      : requestScheduleExit(() => {
          // 변경한 프로필은 명시적 버리기 이후에만 닫는다.
          return setIsProfileEditModalOpen(false);
        });
  };

  // 여행 스타일 태그 선택을 토글한다.
  const handleToggleTravelStyle = (tag: string) => {
    // 저장된 요청 본문과 화면의 선택값을 일치시킨다.
    return profileSave.current.running
      ? undefined
      : setEditTravelStyles((prev) => {
          // 선택한 태그만 해제하고 다른 선택은 유지한다.
          return prev.includes(tag)
            ? prev.filter((item) => {
                // 사용자가 누른 태그 하나만 제외한다.
                return item !== tag;
              })
            : [...prev, tag];
        });
  };

  // 프로필 정보 수정을 서버 및 스토어에 반영한다.
  const handleSaveProfile = () => {
    // 실제 서버 저장이 끝나야 완료 안내를 표시한다.
    return !currentUser
      ? Alert.alert('알림', '로그인과 닉네임을 확인해 주세요.')
      : !validProfileNickname(editNickname, currentUser.nickname)
        ? Alert.alert('닉네임 확인', nicknameError)
        : profileSave.current.running
          ? undefined
          : (setIsSavingProfile(true),
            saveScopedProfile(
              profileSave.current,
              () => {
                // 서버 응답을 적용할 때마다 실제 현재 계정을 읽는다.
                return useTripStore.getState().currentUser?.id;
              },
              () => {
                // 저장 버튼을 누른 시점의 입력을 고정한다.
                return updateUserProfile(userId, {
                  nickname: editNickname,
                  bio: editBio.trim() || null,
                  travelStyles: editTravelStyles,
                });
              },
              {
                success: (profile) => {
                  // 서버 확정 결과를 반영하고 편집 화면을 닫는다.
                  return (
                    updateProfile(profile),
                    setIsProfileEditModalOpen(false),
                    Alert.alert('저장 완료', '프로필을 저장했습니다.')
                  );
                },
                failure: (error: unknown) => {
                  // 실패한 입력은 유지하고 재시도를 안내한다.
                  return Alert.alert(
                    '저장 실패',
                    error instanceof Error && /[가-힣]/.test(error.message)
                      ? error.message
                      : '연결이 끊겼어요. 잠시 후 다시 시도해 주세요.',
                  );
                },
                finish: () => {
                  // 다시 저장할 수 있게 잠금을 해제한다.
                  return setIsSavingProfile(false);
                },
              },
            ));
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
      <ModalBackground>
        <ScreenHeader title="마이페이지" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 사용자 프로필 카드 */}
          <View style={styles.profileCard}>
            <View
              style={[
                styles.profileCardHeader,
                largeText && styles.profileCardHeaderLarge,
              ]}
            >
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
                    ? '게스트 여행은 이 기기에만 보관합니다'
                    : userId
                      ? '여행과 기록을 계정에 보관합니다'
                      : '로그인 전 둘러보기 중입니다'}
                </Text>
              </View>
              <DesignButton
                label="수정"
                accessibilityLabel="프로필 수정"
                size="chip"
                variant="quiet"
                disabled={isSavingProfile}
                onPress={openProfileEditModal}
                icon={(color) => {
                  /* 수정 아이콘에 버튼 상태색을 적용한다. */ return (
                    <Ionicons name="pencil" size={18} color={color} />
                  );
                }}
              />
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
            {currentUser?.travelStyles &&
            currentUser.travelStyles.length > 0 ? (
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
                회원가입 후에는 새 여행을 계정에 보관할 수 있어요. 기존 게스트
                여행은 이 기기에 남으며 자동으로 다른 기기에 옮겨지지 않아요.
              </Text>
              <Action
                label="로그인 / 회원가입"
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
                          trip.status !== 'ARCHIVED' &&
                          ['PLANNED', 'DRAFT'].includes(tripPhase(trip))
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
                        return (
                          trip.status !== 'ARCHIVED' &&
                          tripPhase(trip) === 'COMPLETED'
                        );
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
          <DesignButton
            label="로그아웃"
            variant="danger"
            onPress={handleLogout}
            icon={(color) => {
              /* 로그아웃은 위험 행동의 대비를 유지한다. */ return (
                <Ionicons name="log-out-outline" size={18} color={color} />
              );
            }}
          />
        </ScrollView>
      </ModalBackground>
      {/* 개인 프로필 수정 모달 */}
      <Modal
        visible={isProfileEditModalOpen}
        accessibilityLabel="개인 프로필 수정"
        blockNavigation={false}
        animationType="slide"
        transparent
        onRequestClose={closeProfileEditModal}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={{ padding: 20, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <ScreenHeader
              inset={false}
              title="개인 프로필 수정"
              backLabel="프로필 수정 닫기"
              onBack={closeProfileEditModal}
              disabled={isSavingProfile}
            />
            <Text style={styles.modalDesc}>
              닉네임과 소개, 좋아하는 여행 스타일을 적어보세요.
            </Text>

            {/* 닉네임 입력 */}
            <View style={styles.editInputGroup}>
              <Text style={styles.editInputLabel}>닉네임</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editNickname}
                editable={!isSavingProfile}
                onChangeText={setEditNickname}
                accessibilityLabel="닉네임"
                placeholder="닉네임 입력"
                placeholderTextColor={colors.mutedLight}
              />
              <Text style={styles.editInputLabel}>{nicknameHint}</Text>
              {!validProfileNickname(editNickname, currentUser?.nickname) ? (
                <Text accessibilityRole="alert" style={styles.editInputLabel}>
                  {nicknameError}
                </Text>
              ) : null}
            </View>

            {/* 한 줄 소개 입력 */}
            <View style={styles.editInputGroup}>
              <Text style={styles.editInputLabel}>한 줄 소개 (소개글)</Text>
              <TextInput
                style={[styles.modalTextInput, styles.bioInput]}
                value={editBio}
                editable={!isSavingProfile}
                onChangeText={setEditBio}
                accessibilityLabel="한 줄 소개"
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
                    <DesignButton
                      key={tag}
                      label={tag}
                      size="chip"
                      selected={isSelected}
                      disabled={isSavingProfile}
                      onPress={() => {
                        /* 선택한 여행 스타일 하나만 토글한다. */ return handleToggleTravelStyle(
                          tag,
                        );
                      }}
                    />
                  );
                })}
              </View>
            </View>

            {/* 저장 CTA 버튼 */}
            <DesignButton
              label={isSavingProfile ? '저장 중...' : '프로필 저장하기'}
              variant="primary"
              loading={isSavingProfile}
              disabled={!currentUser}
              onPress={handleSaveProfile}
              icon={(color) => {
                /* 저장 완료 행동에 공통 전경색을 적용한다. */ return (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={color}
                  />
                );
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 마이페이지 화면 스타일 규격
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: { marginBottom: 16 },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    gap: 12,
    flexWrap: 'wrap',
  },
  profileCardHeaderLarge: { flexDirection: 'column', alignItems: 'stretch' },
  avatar: {
    width: 52,
    minHeight: 52,
    paddingVertical: 4,
    borderRadius: 26,
    backgroundColor: colors.selectedSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.text },
  profileInfo: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  authBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  authBadgeText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  userEmail: { fontSize: 14, color: colors.muted },
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
    fontSize: 14,
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
    fontSize: 16,
    color: colors.text,
    flex: 1,
    lineHeight: 26,
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
    fontSize: 14,
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
  summaryItem: { alignItems: 'center', flex: 1, minWidth: 0 },
  summaryNum: { fontSize: 20, fontWeight: '700', color: colors.primary },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  summaryDivider: { width: 1, height: 24, backgroundColor: colors.border },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.text,
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
  settingDesc: { fontSize: 14, color: colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  infoLabel: { fontSize: 14, color: colors.muted },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
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
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    flexGrow: 0,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.text,
  },
  modalDesc: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  editInputGroup: { gap: 6 },
  editInputLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  modalTextInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 26,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  bioInput: {
    minHeight: 60,
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
    fontSize: 14,
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
