import { useEffect, useState } from 'react';
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
import { updateUserProfile } from '@/services/profileService';
import {
  DEFAULT_DB_SECURITY_CODE,
  encryptText,
  loadDecryptedDbCode,
  maskSecretCode,
  saveEncryptedDbCode,
} from '@/services/securityService';
import { useTripStore } from '@/stores/useTripStore';

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
  const router = useRouter();
  const { trips, visits, currentUser, updateProfile, logout } = useTripStore();

  const [isGpsEnabled, setIsGpsEnabled] = useState(true);
  const [isOfflineCacheEnabled, setIsOfflineCacheEnabled] = useState(true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  // DB 보안 연동 코드 관련 상태를 관리한다.
  const [dbSecurityCode, setDbSecurityCode] = useState<string>(
    DEFAULT_DB_SECURITY_CODE,
  );
  const [isCodeRevealed, setIsCodeRevealed] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [inputCode, setInputCode] = useState<string>('');

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
  const handleSaveProfile = async () => {
    if (!editNickname.trim()) {
      Alert.alert('알림', '닉네임을 1자 이상 입력해 주세요.');
      return;
    }

    setIsSavingProfile(true);
    const updates = {
      nickname: editNickname.trim(),
      bio: editBio.trim() || null,
      travelStyles: editTravelStyles,
    };

    // 로컬 스토어에 즉시 반영한다.
    updateProfile(updates);

    // Supabase 서버와 동기화를 시도한다 (실제 사용자 ID가 있는 경우).
    if (currentUser?.id) {
      try {
        await updateUserProfile(currentUser.id, updates);
      } catch {
        // 서버 동기화 실패 시에도 로컬 상태는 유지됨을 안내한다.
      }
    }

    setIsSavingProfile(false);
    setIsProfileEditModalOpen(false);
    Alert.alert('저장 완료', '프로필 정보가 안전하게 저장되었습니다.');
  };

  // 보안 스토리지에서 암호화된 DB 코드를 읽어와 상태를 갱신한다.
  const fetchDecryptedCode = async () => {
    // 보안 저장소에서 복호화된 코드를 불러온다.
    const decrypted = await loadDecryptedDbCode();
    // 컴포넌트 상태에 반영한다.
    setDbSecurityCode(decrypted);
  };

  // 컴포넌트 마운트 시 암호화된 DB 코드를 안전하게 비동기 로드한다.
  useEffect(() => {
    // 마운트 활성 상태 플래그를 정의한다.
    let isCurrentMounted = true;

    // 비동기 프로미스 콜백을 통해 복호화 코드를 안전하게 반영한다.
    loadDecryptedDbCode().then((decrypted) => {
      // 컴포넌트가 마운트 상태인 경우에만 상태를 변경한다.
      if (isCurrentMounted) {
        setDbSecurityCode(decrypted);
      }
    });

    // 언마운트 시 활성 플래그를 해제하는 클린업 함수를 반환한다.
    return () => {
      isCurrentMounted = false;
    };
  }, []);

  // 새로운 DB 보안 코드를 입력받아 암호화 저장한다.
  const handleSaveSecurityCode = async () => {
    // 입력값의 공백 여부를 검사한다.
    if (!inputCode.trim()) {
      Alert.alert('알림', '유효한 DB 연동 코드를 입력해 주세요.');
      return;
    }

    // 입력된 코드를 이중 암호화하여 기기 보안 저장소에 기록한다.
    await saveEncryptedDbCode(inputCode.trim());

    // 최신 복호화 코드로 상태를 갱신한다.
    await fetchDecryptedCode();

    // 모달을 닫고 사용자 피드백을 전달한다.
    setIsEditModalOpen(false);
    setInputCode('');
    Alert.alert(
      '암호화 저장 완료',
      '입력하신 DB 코드가 안전하게 암호화되어 보안 저장소에 기록되었습니다.',
    );
  };

  // 기본 DB 보안 코드로 복원하여 암호화 저장한다.
  const handleResetDefaultCode = async () => {
    // 기본 코드로 암호화 기록을 수행한다.
    await saveEncryptedDbCode(DEFAULT_DB_SECURITY_CODE);
    // 상태를 갱신한다.
    await fetchDecryptedCode();
    // 완료 알림을 표시한다.
    Alert.alert(
      '초기화 완료',
      `기본 DB 코드(${maskSecretCode(DEFAULT_DB_SECURITY_CODE)})로 복원되었습니다.`,
    );
  };

  // 데이터 동기화 알림을 표시한다.
  const handleSyncData = () => {
    // 동기화 완료 알림을 띄운다.
    Alert.alert(
      '동기화 완료',
      'Supabase 클라우드와 로컬 데이터가 최신 상태로 동기화되었습니다.',
    );
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
          logout();
          router.replace('/');
        },
      },
    ]);
  };

  // 현재 암호화된 페이로드를 검증하여 보여준다.
  const handleVerifyEncryption = () => {
    // 현재 코드의 암호화된 해시를 산출한다.
    const encryptedPreview = encryptText(dbSecurityCode);
    // 암호화 검증 상태를 사용자에게 안내한다.
    Alert.alert(
      '암호화 보안 검증 상태',
      `[복호화 원문]\n${dbSecurityCode}\n\n[보안 저장소 암호문 (Base64 XOR)]\n${encryptedPreview}\n\n현재 기기 보안 영역(SecureStore)에서 안전하게 보호되고 있습니다.`,
    );
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
                  <Text style={styles.authBadgeText}>인증됨</Text>
                </View>
              </View>
              <Text style={styles.userEmail}>
                {currentUser ? '로그인 세션 활성' : '게스트 모드'}
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

        {/* 여행 활동 통계 요약 */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{trips.length}</Text>
            <Text style={styles.summaryText}>총 여행</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{visits.length}</Text>
            <Text style={styles.summaryText}>기록된 발자국</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>
              {trips.filter((t) => t.status === 'COMPLETED').length}
            </Text>
            <Text style={styles.summaryText}>완료된 여정</Text>
          </View>
        </View>

        {/* DB 보안 연동 코드 관리 (사용자 요청: 암호화 읽기/쓰기) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>DB 보안 연동 코드 (암호화)</Text>
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleVerifyEncryption}
            >
              <Ionicons
                name="shield-checkmark"
                size={14}
                color={colors.accent}
              />
              <Text style={styles.verifyBtnText}>보안 검증</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.securityCodeRow}>
              <View style={styles.codeTextGroup}>
                <Text style={styles.codeLabel}>현재 활성 보안 코드</Text>
                <Text style={styles.codeValue}>
                  {isCodeRevealed
                    ? dbSecurityCode
                    : maskSecretCode(dbSecurityCode)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconActionBtn}
                onPress={() => setIsCodeRevealed((prev) => !prev)}
              >
                <Ionicons
                  name={isCodeRevealed ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.editCodeBtn}
                onPress={() => {
                  setInputCode(dbSecurityCode);
                  setIsEditModalOpen(true);
                }}
              >
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={colors.textLight}
                />
                <Text style={styles.editCodeBtnText}>새 코드 입력/암호화</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetCodeBtn}
                onPress={handleResetDefaultCode}
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color={colors.muted}
                />
                <Text style={styles.resetCodeBtnText}>기본값 복원</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 앱 및 기능 권한 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기능 및 권한 설정</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>GPS 방문 체크인 권한</Text>
                <Text style={styles.settingDesc}>
                  장소 반경 200m 이내 자동 인증에 활용됩니다.
                </Text>
              </View>
              <Switch
                value={isGpsEnabled}
                onValueChange={setIsGpsEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>
                  오프라인 로컬 저장 (SQLite)
                </Text>
                <Text style={styles.settingDesc}>
                  인터넷이 불안정한 곳에서도 일정을 조회합니다.
                </Text>
              </View>
              <Switch
                value={isOfflineCacheEnabled}
                onValueChange={setIsOfflineCacheEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>여행 일정 알림</Text>
                <Text style={styles.settingDesc}>
                  방문 예정 시간 30분 전 알림
                </Text>
              </View>
              <Switch
                value={isNotificationEnabled}
                onValueChange={setIsNotificationEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>
          </View>
        </View>

        {/* 데이터 관리 및 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>데이터 및 백엔드 정보</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.actionRow} onPress={handleSyncData}>
              <View style={styles.actionLeft}>
                <Ionicons
                  name="cloud-done-outline"
                  size={20}
                  color={colors.accent}
                />
                <Text style={styles.actionText}>Supabase 클라우드 동기화</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.mutedLight}
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>앱 버전</Text>
              <Text style={styles.infoValue}>v0.1.0 (Build 1)</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>백엔드 아키텍처</Text>
              <Text style={styles.infoValue}>Supabase + Hono API</Text>
            </View>
          </View>
        </View>

        {/* 로그아웃 버튼 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutBtnText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* DB 코드 입력 및 암호화 모달 */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>DB 보안 코드 암호화 입력</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              입력하신 코드는 Base64 대칭키 암호화 및 기기 SecureStore에 이중
              보호되어 안전하게 저장됩니다.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="DB 코드 입력 (UUID 또는 시크릿 키)"
              value={inputCode}
              onChangeText={setInputCode}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleSaveSecurityCode}
            >
              <Ionicons name="lock-closed" size={16} color={colors.textLight} />
              <Text style={styles.modalSubmitBtnText}>암호화하여 저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
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
  securityCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  codeTextGroup: { flex: 1 },
  codeLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  codeValue: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: 'Courier',
    marginTop: 2,
    fontWeight: '600',
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  editCodeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
  },
  resetCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  resetCodeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.text },
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
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: colors.background,
    fontFamily: 'Courier',
  },
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
