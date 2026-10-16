import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import DesignButton from '@/components/DesignButton';
import type { WorkspaceSnapshot } from '@wherego/domain';

// 함께 계획 중인 실제 멤버와 기존 동행 관리 화면의 진입점을 표시한다.
export default function TripCompanions({
  members,
  onOpen,
}: {
  members: WorkspaceSnapshot['members'];
  onOpen: () => void;
}) {
  // 실시간 접속이나 임의의 인원 수를 만들지 않는다.
  return (
    <View style={s.row}>
      <View accessible={false} style={s.avatars}>
        {members.slice(0, 3).map((member, index) => {
          // 실제 닉네임의 첫 글자만 사용하고 작은 글자는 항상 네이비로 표시한다.
          return (
            <View
              key={member.memberId}
              style={[s.avatar, index === 0 && s.first]}
            >
              <Text style={s.initial}>
                {[...member.nickname.trim()][0] || '여'}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={s.meta}>함께하는 {members.length}명</Text>
      <DesignButton
        label="동행 보기 →"
        size="chip"
        variant="quiet"
        accessibilityLabel="동행 보기"
        onPress={onOpen}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  avatars: { flexDirection: 'row', paddingLeft: 4 },
  avatar: {
    minWidth: 32,
    minHeight: 32,
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.selectedSurface,
    borderWidth: 2,
    borderColor: colors.surface,
    marginLeft: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  first: { backgroundColor: colors.brandCoral },
  initial: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 22, flexShrink: 1 },
  link: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  label: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
});
