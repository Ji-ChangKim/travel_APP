import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import type { WorkspaceSnapshot } from '@wherego/domain';
import { View } from 'react-native';
import ReceiptDetails from '../../receipt/ui/ReceiptDetails';
import { Action } from '../../shared/ui/ui';
import type { WorkspaceScreenActions } from '../model/workspaceScreenActions';
import { styles } from '../styles/workspaceStyles';

// 원본 보관 여부에 따른 표현 차이만 적용하고 수정·삭제는 기존 행동에 위임한다.
export default function WorkspaceReceiptCard({
  receipt,
  informationOnly = false,
  disabled,
  actions,
}: {
  receipt: WorkspaceSnapshot['receipts'][number];
  informationOnly?: boolean;
  disabled: boolean;
  actions: Pick<WorkspaceScreenActions, 'editReceipt' | 'deleteReceipt'>;
}) {
  return (
    <View style={informationOnly ? styles.card : undefined}>
      <Text style={informationOnly ? styles.title : undefined}>
        {receipt.merchant} · {receipt.date} · {receipt.amount}{' '}
        {receipt.currency}
      </Text>
      {informationOnly && (
        <Text style={styles.subtitle}>{t('정보만 저장한 영수증')}</Text>
      )}
      <ReceiptDetails receipt={receipt} />
      <Action
        label={t('영수증 기록 수정')}
        disabled={disabled}
        onPress={() => actions.editReceipt(receipt)}
      />
      <Action
        variant={informationOnly ? undefined : 'danger'}
        label={t('영수증 기록·지출 삭제')}
        disabled={disabled}
        onPress={() => actions.deleteReceipt(receipt)}
      />
    </View>
  );
}
