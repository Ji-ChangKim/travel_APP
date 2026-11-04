import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { styles as accountStyles } from '../styles/myAccountStyles';
import type { AccountRetirementController } from '../manager/useAccountRetirement';

import { getLocale } from '@/features/localization/localeState';
import { Action } from '@/features/workspace/shared/ui/ui';
import { styles } from '@/features/workspace/hub/styles/workspaceStyles';

// 탈퇴 완료 상태와 요청 전 정책 안내 중 현재 필요한 내용을 선택한다.
export default function AccountRetirementSection(
  props: AccountRetirementController,
) {
  const { completed } = props;
  return completed ? (
    <AccountRetirementCompleted {...props} />
  ) : (
    <View style={accountStyles.section}>
      <Text style={accountStyles.sectionTitle}>{t('회원 탈퇴')}</Text>
      <AccountRetirementPolicy />
      <AccountRetirementActions {...props} />
    </View>
  );
}
// 서버가 확정한 삭제 예정일과 복구 진입을 표시한다.
function AccountRetirementCompleted({
  completed,
  router,
}: Pick<AccountRetirementController, 'completed' | 'router'>) {
  return (
    <View style={accountStyles.section}>
      <Text style={accountStyles.sectionTitle}>
        {t('탈퇴 유예를 시작했어요')}
      </Text>
      <View style={[accountStyles.card, { gap: 12 }]}>
        <Text>
          {new Date(completed).toLocaleDateString(getLocale())}
          {t(
            '에 계정 연결 정보를 삭제해요. 90일 안에 다시 로그인하면 탈퇴가 취소되고 여행을 다시 볼 수 있어요.',
          )}
        </Text>
        <Action
          label={t('로그인 화면으로')}
          variant="primary"
          onPress={() => {
            // 실제 탈퇴 요청 성공 뒤 로그인 화면으로 이동한다.
            return router.replace('/login');
          }}
        />
      </View>
    </View>
  );
}
// 계정과 분리해 보관할 자료와 복구 유예 정책을 설명한다.
function AccountRetirementPolicy() {
  return (
    <View style={accountStyles.listCard}>
      <View style={accountStyles.listRow}>
        <View style={accountStyles.listIconBoxNeutral}>
          <Ionicons
            name="person-remove-outline"
            size={20}
            color={colors.text}
          />
        </View>
        <View style={accountStyles.listTextGroup}>
          <Text style={accountStyles.listTitle}>
            {t('즉시 로그아웃 및 탈퇴 멤버 전환')}
          </Text>
          <Text style={accountStyles.listSubtitle}>
            {t(
              '탈퇴를 요청하면 로그아웃되고, 여행에서는 ‘탈퇴 멤버’로 표시돼요.',
            )}
          </Text>
        </View>
      </View>
      <View style={accountStyles.listDivider} />
      <View style={accountStyles.listRow}>
        <View style={accountStyles.listIconBoxNeutral}>
          <Ionicons name="time-outline" size={20} color={colors.text} />
        </View>
        <View style={accountStyles.listTextGroup}>
          <Text style={accountStyles.listTitle}>
            {t('90일 복구 유예 기간')}
          </Text>
          <Text style={accountStyles.listSubtitle}>
            {t(
              '90일 안에 같은 계정으로 다시 로그인하면 탈퇴를 취소하고 여행을 복구할 수 있어요. 90일이 지나면 이메일·로그인 연결·프로필을 삭제해요.',
            )}
          </Text>
        </View>
      </View>
      <View style={accountStyles.listDivider} />
      <View style={accountStyles.listRow}>
        <View style={accountStyles.listIconBoxNeutral}>
          <Ionicons name="folder-open-outline" size={20} color={colors.text} />
        </View>
        <View style={accountStyles.listTextGroup}>
          <Text style={accountStyles.listTitle}>
            {t('여행·영수증·동행자 기록 보존')}
          </Text>
          <Text style={accountStyles.listSubtitle}>
            {t(
              '내가 만든 여행과 함께한 여행, 사진·영수증·공개본은 계정과 분리해 보관해요. 혼자 만든 여행도 보관되며 동행자의 여행 접근과 기존 권한은 유지돼요. 소유권을 다른 동행자에게 넘기지 않아요.',
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}
// 현재 회원 상태에 따라 탈퇴 확인 또는 재인증 행동을 제공한다.
function AccountRetirementActions({
  user,
  userId,
  busy,
  error,
  reauthenticate,
  router,
  setConfirming,
  requestReauthentication,
}: Pick<
  AccountRetirementController,
  | 'user'
  | 'userId'
  | 'busy'
  | 'error'
  | 'reauthenticate'
  | 'router'
  | 'setConfirming'
  | 'requestReauthentication'
>) {
  return (
    <View style={{ marginTop: 16, gap: 12 }}>
      {!user || user.authProvider === 'guest' ? (
        <>
          <Text style={accountStyles.settingDesc}>
            {user
              ? t(
                  '기기에 보관한 게스트 여행은 회원 탈퇴로 삭제되지 않아요. 연결한 회원 계정을 관리하려면 해당 계정으로 로그인해 주세요.',
                )
              : t('TripPrint 계정으로 로그인한 뒤 탈퇴를 요청할 수 있어요.')}
          </Text>
          <Action
            label={t('로그인하고 계정 관리')}
            variant="primary"
            onPress={() => {
              // 로그인 후 외부 주소 대신 고정된 계정 관리로 돌아온다.
              return router.push({
                pathname: '/login',
                params: { next: 'account' },
              });
            }}
          />
        </>
      ) : (
        <Action
          label={busy ? t('요청 중…') : t('탈퇴 내용 확인')}
          variant="danger"
          loading={busy}
          onPress={() => {
            // 보존 범위를 읽은 본인 계정으로 확인 대상을 고정한다.
            return setConfirming(userId);
          }}
        />
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(error)}
        </Text>
      ) : null}
      {reauthenticate && (
        <Action
          label={t('로그아웃하고 다시 확인')}
          disabled={busy}
          onPress={requestReauthentication}
        />
      )}
    </View>
  );
}
