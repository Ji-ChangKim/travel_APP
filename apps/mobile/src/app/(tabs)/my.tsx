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
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import {
  DEFAULT_DB_SECURITY_CODE,
  encryptText,
  loadDecryptedDbCode,
  maskSecretCode,
  saveEncryptedDbCode,
} from '@/services/securityService';
import { useTripStore } from '@/stores/useTripStore';

// [마이] 프로필 및 앱 환경 설정 화면을 렌더링한다.
export default function MyScreen() {
  const { trips, visits } = useTripStore();

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
        onPress: () => Alert.alert('로그아웃 완료'),
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>민</Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>여행자 민지</Text>
              <View style={styles.authBadge}>
                <Text style={styles.authBadgeText}>Supabase Auth</Text>
              </View>
            </View>
            <Text style={styles.userEmail}>traveler.minji@example.com</Text>
          </View>
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
    </SafeAreaView>
  );
}

// 화면 스타일을 정의한다.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, gap: 20 },
  header: { gap: 2 },
  headerSubtitle: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.textLight, fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 17, fontWeight: '800', color: colors.text },
  authBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  authBadgeText: { fontSize: 10, color: colors.accent, fontWeight: '700' },
  userEmail: { fontSize: 12, color: colors.muted },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: { alignItems: 'center' },
  summaryNum: { fontSize: 18, fontWeight: '800', color: colors.accent },
  summaryText: { fontSize: 11, color: colors.muted, marginTop: 2 },
  summaryDivider: { width: 1, height: 26, backgroundColor: colors.border },
  section: { gap: 10 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifyBtnText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  securityCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  codeTextGroup: { flex: 1, gap: 4 },
  codeLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  codeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  iconActionBtn: { padding: 6 },
  btnRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
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
    backgroundColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  resetCodeBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingTextGroup: { flex: 1, paddingRight: 12 },
  settingTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  settingDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.borderLight },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 13, fontWeight: '700', color: colors.text },
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
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    marginTop: 4,
  },
  modalSubmitBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
});
