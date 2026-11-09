import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import { View } from 'react-native';
import { Action } from '@/features/workspace/shared/ui/ui';
import { styles } from '../styles/myAccountStyles';
import type { AccountRetirementController } from '../manager/useAccountRetirement';

// 삭제할 자료·공유 참여·소유권 이전을 구분하고 실제 접수 결과를 표시한다.
export default function AccountRetirementSection(
  props: AccountRetirementController,
) {
  if (props.completed)
    return (
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('삭제 요청을 접수했어요')}
        </Text>
        <View style={[styles.card, { gap: 12 }]}>
          <Text>
            {t(
              '계정 이용을 종료하고 자료를 삭제하고 있어요. 삭제가 모두 끝났다는 뜻은 아니에요.',
            )}
          </Text>
          <Action
            label={t('로그인 화면으로')}
            variant="primary"
            onPress={() => props.router.replace('/login')}
          />
        </View>
      </View>
    );
  if (!props.user || props.user.authProvider === 'guest')
    return (
      <View style={[styles.card, { gap: 12 }]}>
        <Text style={styles.settingDesc}>
          {t(
            '기기에 보관한 게스트 여행은 회원 계정 삭제로 지워지지 않아요. 회원 계정은 로그인한 뒤 관리할 수 있어요.',
          )}
        </Text>
        <Action
          label={t('로그인하고 계정 관리')}
          onPress={() =>
            props.router.push({
              pathname: '/login',
              params: { next: 'account' },
            })
          }
        />
      </View>
    );
  return (
    <View style={[styles.section, { gap: 16 }]}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {t('계정 삭제 전 확인')}
      </Text>
      <View style={[styles.card, { gap: 12 }]}>
        <Text>
          {t(
            '계정 삭제를 요청하면 모든 기기에서 로그아웃돼요. 복구 유예 없이 계정과 개인 여행·사진·영수증을 삭제해요.',
          )}
        </Text>
        <Text style={styles.settingDesc}>
          {t(
            '함께한 여행에서는 나의 참여와 개인정보를 정리해요. 다른 동행자의 기록은 남아요.',
          )}
        </Text>
      </View>
      {props.loading ? (
        <Text accessibilityLiveRegion="polite">
          {t('계정과 여행을 확인하고 있어요.')}
        </Text>
      ) : null}
      {props.management ? <DeletionSummary {...props} /> : null}
      {props.notice ? (
        <Text accessibilityLiveRegion="polite">{t(props.notice)}</Text>
      ) : null}
      {props.error ? (
        <Text accessibilityRole="alert" style={styles.settingDesc}>
          {t(props.error)}
        </Text>
      ) : null}
      {!props.loading && !props.management ? (
        <Action
          label={t('계정 상태 다시 확인')}
          disabled={props.busy}
          onPress={props.reload}
        />
      ) : null}
      {props.error && props.management ? (
        <Action
          label={t('계정 상태 다시 확인')}
          disabled={props.busy}
          onPress={props.reload}
        />
      ) : null}
      {props.reauthenticate ? (
        <Action
          label={t('다시 로그인하고 확인')}
          disabled={props.busy}
          onPress={props.requestReauthentication}
        />
      ) : null}
      <Action
        label={t('계정 삭제 내용 확인')}
        variant="danger"
        disabled={
          props.busy ||
          props.loading ||
          !props.management ||
          props.reauthenticate ||
          Boolean(props.management.preview.ownershipTransfersRequired.length)
        }
        onPress={props.confirmDeletion}
      />
    </View>
  );
}

function DeletionSummary(props: AccountRetirementController) {
  const data = props.management;
  if (!data) return null;
  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.card, { gap: 12 }]}>
        <Text>
          {t('삭제할 개인 여행 {count}개', {
            count: data.preview.ownedTripsToDelete.length,
          })}
        </Text>
        <Text>
          {t('참여를 종료할 공유 여행 {count}개', {
            count: data.preview.sharedTripsToLeave.length,
          })}
        </Text>
        <Text>
          {t('소유권 이전이 필요한 여행 {count}개', {
            count: data.preview.ownershipTransfersRequired.length,
          })}
        </Text>
      </View>
      {data.transfers.length ? (
        <Text style={styles.settingDesc}>
          {t(
            '함께 관리하는 여행은 소유권을 먼저 넘겨주세요. 현재 참여한 동행자 중 새 소유자를 직접 선택해 주세요.',
          )}
        </Text>
      ) : null}
      {data.transfers.map((trip) => (
        <View key={trip.id} style={[styles.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={styles.userName}>
            {trip.title}
          </Text>
          {trip.candidates.map((member, index) => (
            <Action
              key={member.id}
              label={t('{name} · 동행자 {number}', {
                name: member.name,
                number: index + 1,
              })}
              selected={props.selection[trip.id] === member.id}
              disabled={props.busy || props.loading}
              onPress={() => props.chooseOwner(trip.id, member.id)}
            />
          ))}
          {!trip.candidates.length ? (
            <Text style={styles.settingDesc}>
              {t(
                '이전할 동행자를 찾지 못했어요. 계정 상태를 다시 확인해 주세요.',
              )}
            </Text>
          ) : null}
          <Action
            label={t('소유권 이전 내용 확인')}
            disabled={
              props.busy ||
              props.loading ||
              props.reauthenticate ||
              !props.selection[trip.id]
            }
            onPress={() => props.confirmTransfer(trip.id)}
          />
        </View>
      ))}
    </View>
  );
}
