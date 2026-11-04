import { t } from '@/features/localization/translate';

import Text from '@/components/AppText';

import type { WorkspaceSnapshot } from '@wherego/domain';

import { View } from 'react-native';

import { TripMemberHeading } from './TripDetailParts';

import { memberRoleLabel } from './presentation';

import { tripDetailStyles as detail } from './tripDetailStyles';

import { Action } from './ui';

import type { WorkspaceScreenActions } from './workspaceScreenActions';
import { styles } from './workspaceStyles';

type RenderWorkspaceMembersProps = {
  activeSection: string;
  snapshot: WorkspaceSnapshot;
  owner: boolean;
  busy: boolean;
  scanning: boolean;
  hasPending: boolean;
  invite: (role: 'viewer' | 'editor') => void;
  actions: WorkspaceScreenActions;
};

// 동행자와 초대 관리 행동을 표시한다.
export function renderWorkspaceMembers({
  activeSection,
  snapshot,
  owner,
  busy,
  scanning,
  hasPending,
  invite,
  actions,
}: RenderWorkspaceMembersProps) {
  return (
    activeSection === 'companions' && (
      <View testID="trip-companions-panel" style={detail.section}>
        <Text style={detail.title}>{t('동행')}</Text>
        <Text style={detail.meta}>
          {t('함께하는')} {snapshot.members.length}
          {t('명 · 여행을 만든 사람이 초대와 역할을 관리해요.')}
        </Text>
        {snapshot.members.map((member) => (
          <View key={member.memberId} style={detail.card}>
            <TripMemberHeading member={member} />
            {owner && member.role !== 'owner' && (
              <View style={styles.row}>
                <Action
                  label={
                    member.role === 'viewer'
                      ? t('편집자로 변경')
                      : t('보기 전용으로 변경')
                  }
                  disabled={busy || scanning || hasPending}
                  onPress={() => actions.changeMemberRole(member)}
                />
                <Action
                  variant="danger"
                  label={t('동행 참여 해제')}
                  disabled={busy || scanning || hasPending}
                  onPress={() => actions.removeMember(member)}
                />
              </View>
            )}
          </View>
        ))}
        {owner && (
          <>
            <View style={styles.row}>
              <Action
                label={t('편집 초대 공유')}
                variant="primary"
                disabled={busy || scanning || hasPending}
                onPress={() => {
                  // 공동 작성 가능한 초대를 발급한다.
                  invite('editor');
                }}
              />
              <Action
                label={t('보기 초대 공유')}
                disabled={busy || scanning || hasPending}
                onPress={() => {
                  // 읽기 전용 역할을 서버에 기록한다.
                  invite('viewer');
                }}
              />
            </View>
            <Text style={detail.title}>{t('초대 내역')}</Text>
            {!snapshot.invites.length && (
              <Text style={detail.meta}>
                {t(
                  '아직 보낸 초대가 없어요. 위에서 함께할 사람을 초대해 보세요.',
                )}
              </Text>
            )}
            {snapshot.invites.map((item) => (
              <View key={item.id} style={detail.card}>
                <Text style={detail.meta}>
                  {memberRoleLabel(item.role)} {t('· 만료')}{' '}
                  {item.expiresAt.slice(0, 10)} ·{' '}
                  {item.revokedAt
                    ? t('취소됨')
                    : item.usedAt
                      ? t('수락됨')
                      : t('대기 중')}
                </Text>
                {!item.revokedAt && (
                  <Action
                    variant="danger"
                    label={t('초대 취소')}
                    disabled={busy || scanning || hasPending}
                    onPress={() => actions.revokeInvite(item)}
                  />
                )}
              </View>
            ))}
          </>
        )}
      </View>
    )
  );
}
