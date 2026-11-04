import CenteredNoticeModal from '@/components/ui/CenteredNoticeModal';
import DesignButton from '@/components/ui/DesignButton';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import type useLoginController from '../manager/useLoginController';

// 실패한 행동의 재시도만 제공하고 취소·이용 가능 조회는 팝업으로 승격하지 않는다.
export default function AuthFailureNotice({
  controller,
  onAlternative,
}: {
  controller: ReturnType<typeof useLoginController>;
  onAlternative?: () => void;
}) {
  useLocale();
  const failure = controller.failure;
  const retry =
    failure === 'google'
      ? controller.startGoogle
      : failure === 'guest'
        ? controller.startGuest
        : failure === 'logout'
          ? controller.switchAccount
          : controller.continueSession;
  return (
    <CenteredNoticeModal
      visible={Boolean(failure && controller.error && !controller.busy)}
      title={t(
        failure === 'guest'
          ? '게스트 시작 안내'
          : failure === 'continue'
            ? '여행 열기 안내'
            : failure === 'logout'
              ? '로그아웃 안내'
              : '로그인 안내',
      )}
      paragraphs={
        failure === 'guest'
          ? [
              t('게스트를 시작하지 못했어요.'),
              t('처음 시작할 때는 인터넷 연결을 확인해 주세요.'),
            ]
          : failure === 'continue'
            ? [
                t('계정을 확인하지 못했어요.'),
                t('다시 시도하고 여행을 이어가세요.'),
              ]
            : failure === 'logout'
              ? [t('로그아웃하지 못했어요.'), t('잠시 후 다시 시도해 주세요.')]
              : [
                  t('Google 로그인을 완료하지 못했어요.'),
                  t('다시 시도하거나 다른 방법으로 시작해 주세요.'),
                ]
      }
      onClose={controller.dismissError}
    >
      <DesignButton label={t('다시 시도')} variant="primary" onPress={retry} />
      {onAlternative && (
        <DesignButton
          label={t('다른 방법으로 로그인')}
          onPress={() => {
            controller.dismissError();
            onAlternative();
          }}
        />
      )}
      <DesignButton label={t('닫기')} onPress={controller.dismissError} />
    </CenteredNoticeModal>
  );
}
