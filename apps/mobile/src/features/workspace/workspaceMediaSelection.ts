// 원본 없는 영수증과 사진별 확정 기록을 원래 순서대로 묶는다.
export function workspaceMediaSelection<
  Media extends { id: string; purpose: string },
  Receipt extends { mediaId: string; keepPhoto?: boolean },
>(snapshot: { media: readonly Media[]; receipts: readonly Receipt[] }) {
  const receiptsByMedia = new Map<string, Receipt[]>();
  for (const receipt of snapshot.receipts) {
    const receipts = receiptsByMedia.get(receipt.mediaId) || [];
    receipts.push(receipt);
    receiptsByMedia.set(receipt.mediaId, receipts);
  }
  return {
    informationOnly: snapshot.receipts.filter(
      (receipt) => receipt.keepPhoto === false,
    ),
    mediaEntries: snapshot.media.map((media) => {
      const receipts = receiptsByMedia.get(media.id) || [];
      return {
        media,
        receipts,
        needsReceiptReview:
          media.purpose === 'receipt' && receipts.length === 0,
      };
    }),
  };
}
