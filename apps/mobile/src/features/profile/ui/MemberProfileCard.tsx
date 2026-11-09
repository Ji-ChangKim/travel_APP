import { View } from 'react-native';
import { nicknameHint, nicknameLength } from '@wherego/validation';
import Text from '@/components/ui/AppText';
import DesignButton from '@/components/ui/DesignButton';
import DesignInput from '@/components/ui/DesignInput';
import ActionSheet from '@/components/ui/ActionSheet';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { renderAccountProfile } from './AccountProfileCard';
import { useMemberProfileEditor } from '../manager/useMemberProfileEditor';
import type { AccountProfileProps } from '../model/myAccountTypes';
import { styles } from '../styles/myAccountStyles';

export default function MemberProfileCard(props: AccountProfileProps) {
  useLocale();
  const editor = useMemberProfileEditor(props.currentUser);
  return (
    <>
      {renderAccountProfile({
        ...props,
        imageSource: editor.imageSource,
        children: (
          <View style={styles.accountActions}>
            {editor.editable ? (
              <>
                <DesignButton
                  label={t('닉네임 변경')}
                  disabled={editor.busy || editor.cooldown}
                  onPress={editor.openEditor}
                />
                <Text style={styles.inputHint}>
                  {editor.cooldown && editor.nextChangeAt
                    ? t('다음 닉네임 변경: {date}', {
                        date: new Date(editor.nextChangeAt).toLocaleString(),
                      })
                    : t('닉네임은 변경 후 30일이 지나면 다시 바꿀 수 있어요.')}
                </Text>
                <DesignButton
                  label={t('앨범에서 프로필 사진 선택')}
                  disabled={editor.busy}
                  onPress={() => {
                    void editor.changePhoto(false);
                  }}
                />
                <DesignButton
                  label={t('프로필 사진 촬영')}
                  disabled={editor.busy}
                  onPress={() => {
                    void editor.changePhoto(true);
                  }}
                />
                <Text style={styles.inputHint}>
                  {t(
                    '사진은 언제든 바꿀 수 있어요. 새 사진을 저장하면 이전 사진이 교체돼요.',
                  )}
                </Text>
              </>
            ) : props.currentUser?.authProvider === 'guest' ? (
              <Text style={styles.inputHint}>
                {t('닉네임과 사진을 바꾸려면 Google 계정으로 로그인해 주세요.')}
              </Text>
            ) : null}
            {(editor.profile.isError || editor.photoError) && (
              <>
                <Text accessibilityRole="alert" style={styles.inputHint}>
                  {t('프로필을 불러오지 못했어요. 다시 불러와 주세요.')}
                </Text>
                <DesignButton
                  label={t('프로필 다시 불러오기')}
                  onPress={editor.reload}
                />
              </>
            )}
            {editor.notice ? (
              <Text accessibilityLiveRegion="polite" style={styles.inputHint}>
                {t(editor.notice)}
              </Text>
            ) : null}
            {editor.busy ? (
              <Text accessibilityLiveRegion="polite" style={styles.inputHint}>
                {t('프로필 변경을 처리하고 있어요…')}
              </Text>
            ) : null}
            {editor.error && !editor.open ? (
              <>
                <Text accessibilityRole="alert" style={styles.inputHint}>
                  {t(editor.error)}
                </Text>
                {!editor.profile.isError && !editor.photoError && (
                  <DesignButton
                    label={t('프로필 다시 불러오기')}
                    onPress={editor.reload}
                  />
                )}
              </>
            ) : null}
          </View>
        ),
      })}
      <ActionSheet
        visible={editor.open}
        title={t('닉네임 변경')}
        onClose={editor.closeEditor}
        dismissDisabled={editor.busy}
      >
        <View style={styles.accountActions}>
          <Text>{t(nicknameHint)}</Text>
          <Text>
            {t(
              '특수문자와 앞뒤 공백은 사용할 수 없어요. 영어 대소문자는 같은 이름으로 확인해요.',
            )}
          </Text>
          <Text>{t('저장하면 30일 동안 닉네임을 다시 바꿀 수 없어요.')}</Text>
          <Text>{t('닉네임')}</Text>
          <DesignInput
            accessibilityLabel={t('닉네임')}
            value={editor.nickname}
            onChangeText={editor.changeNickname}
            editable={!editor.busy}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.inputHint}>
            {nicknameLength(editor.nickname)} / 10
          </Text>
          {editor.validation && editor.nickname ? (
            <Text style={styles.inputHint}>{t(editor.validation)}</Text>
          ) : null}
          <DesignButton
            label={t('닉네임 중복 확인')}
            disabled={editor.busy || Boolean(editor.validation)}
            onPress={() => {
              void editor.checkNickname();
            }}
          />
          {editor.checked ? (
            <Text accessibilityLiveRegion="polite">
              {t('사용할 수 있는 닉네임이에요.')}
            </Text>
          ) : null}
          {editor.error ? (
            <>
              <Text accessibilityRole="alert">{t(editor.error)}</Text>
              <DesignButton
                label={t('프로필 다시 불러오기')}
                disabled={editor.busy}
                onPress={editor.reload}
              />
            </>
          ) : null}
          <DesignButton
            label={t('닉네임 저장')}
            variant="primary"
            disabled={
              editor.busy || Boolean(editor.validation) || !editor.checked
            }
            onPress={() => {
              void editor.saveNickname();
            }}
          />
          <DesignButton
            label={t('취소')}
            disabled={editor.busy}
            variant="quiet"
            onPress={editor.closeEditor}
          />
        </View>
      </ActionSheet>
    </>
  );
}
