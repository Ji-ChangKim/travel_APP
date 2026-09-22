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
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import { useTripStore } from '@/stores/useTripStore';
import type { VerificationMethod, Visit } from '@wherego/domain';

// 인증 수단별 배지 텍스트와 스타일을 반환한다.
function getVerificationBadge(method: VerificationMethod) {
  switch (method) {
    case 'gps':
      return {
        label: '📍 GPS 인증',
        bg: colors.accentSoft,
        text: colors.accent,
      };
    case 'receipt':
      return {
        label: '🧾 영수증 인증',
        bg: colors.tagOrange,
        text: colors.tagOrangeText,
      };
    case 'manual':
    default:
      return {
        label: '✍️ 수동 체크',
        bg: colors.borderLight,
        text: colors.muted,
      };
  }
}

// [발자국] 다녀온 방문 기록 및 후기 아카이빙 화면을 렌더링한다.
export default function FootprintsScreen() {
  const { visits, trips } = useTripStore();

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewRating, setReviewRating] = useState(5);

  // 다녀온 장소 후기 등록을 처리한다.
  const handleSaveReview = () => {
    if (!reviewContent.trim() || !selectedVisit) {
      Alert.alert('알림', '후기 내용을 입력해 주세요.');
      return;
    }
    Alert.alert(
      '리뷰 저장 완료',
      `'${selectedVisit.place?.name}'에 ${reviewRating}점 후기를 남겼습니다!`,
    );
    setReviewModalOpen(false);
    setReviewContent('');
  };

  const verifiedCount = visits.filter((v) => v.isVerified).length;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 상단 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>나의 여행 발자취</Text>
          <Text style={styles.headerTitle}>발자국 모아보기</Text>
        </View>

        {/* 통계 요약 카드 */}
        <View style={styles.statCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{visits.length}</Text>
            <Text style={styles.statLabel}>방문한 장소</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{verifiedCount}</Text>
            <Text style={styles.statLabel}>인증된 발자국</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {trips.filter((t) => t.status === 'COMPLETED').length}
            </Text>
            <Text style={styles.statLabel}>완료된 여행</Text>
          </View>
        </View>

        {/* 발자국 리스트 */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            체크인한 발자국 목록 ({visits.length}곳)
          </Text>

          {visits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="footsteps-outline"
                size={40}
                color={colors.mutedLight}
              />
              <Text style={styles.emptyTitle}>
                아직 등록된 발자국이 없습니다.
              </Text>
              <Text style={styles.emptySub}>
                [내 여행] 탭에서 일정 장소에 체크인하면 이곳에 기록됩니다.
              </Text>
            </View>
          ) : (
            visits.map((v, idx) => {
              const badge = getVerificationBadge(v.verification);
              const relatedTrip = trips.find((t) => t.id === v.tripId);
              return (
                <View key={v.id} style={styles.visitCard}>
                  <View style={styles.visitHeader}>
                    <View>
                      <Text style={styles.tripTag}>
                        {relatedTrip?.title || '여행 기록'}
                      </Text>
                      <Text style={styles.placeName}>
                        {idx + 1}. {v.place?.name}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  {v.place?.address && (
                    <Text style={styles.placeAddress}>
                      📍 {v.place.address}
                    </Text>
                  )}
                  <Text style={styles.visitDate}>
                    🕒 {v.visitedAt.slice(0, 10)} 방문 완료
                  </Text>

                  {/* 후기 남기기 버튼 */}
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    onPress={() => {
                      setSelectedVisit(v);
                      setReviewModalOpen(true);
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.reviewBtnText}>
                      방문 후기 및 별점 남기기
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 후기 작성 모달 */}
      <Modal visible={reviewModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {`'${selectedVisit?.place?.name || ''}' 후기 작성`}
              </Text>
              <TouchableOpacity onPress={() => setReviewModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* 별점 선택 */}
            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>방문 만족도:</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                    <Ionicons
                      name={s <= reviewRating ? 'star' : 'star-outline'}
                      size={24}
                      color={colors.starGold}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="이 장소에서의 경험, 팁, 솔직한 느낌을 적어보세요."
              value={reviewContent}
              onChangeText={setReviewContent}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSaveReview}
            >
              <Text style={styles.submitBtnText}>후기 저장하기</Text>
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
  header: { gap: 2 },
  headerSubtitle: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  statCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 22, fontWeight: '800', color: colors.accent },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  listSection: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptySub: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  visitCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tripTag: { fontSize: 11, fontWeight: '700', color: colors.accent },
  placeName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  placeAddress: { fontSize: 12, color: colors.muted },
  visitDate: { fontSize: 11, color: colors.mutedLight },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  reviewBtnText: { fontSize: 12, fontWeight: '700', color: colors.accent },
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
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  starRow: { flexDirection: 'row', gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.background,
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: colors.textLight, fontWeight: '700', fontSize: 14 },
});
