import { Text, View } from 'react-native';
import type { WorkspaceReceipt } from '@wherego/domain';
import { styles } from './ui';

// 저장한 영수증의 일시·주소·메뉴별 지출을 기록과 다이어리에 동일하게 표시한다.
export default function ReceiptDetails({
  receipt,
}: {
  receipt: WorkspaceReceipt;
}) {
  // 등록된 원문 항목과 결제 합계를 분리하여 중복 지출로 계산하지 않는다.
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.subtitle}>
        결제 일시 · {receipt.date} {receipt.transactionTime || ''}
      </Text>
      {receipt.address && (
        <Text style={styles.subtitle}>{receipt.address}</Text>
      )}
      {receipt.items?.map((item, index) => (
        <Text key={index}>
          {item.name} ·{' '}
          {item.quantity === null ? '수량 미확인' : `${item.quantity}개`} ·{' '}
          {item.amount || '금액 미확인'} {receipt.currency}
        </Text>
      ))}
      {receipt.details && <Text>음식·구매 기록: {receipt.details}</Text>}
    </View>
  );
}
