import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import { z } from 'zod';
import {
  trailFlightSchema,
  trailJourneySchema,
  trailPlanSchema,
  trailReceiptSchema,
} from '@wherego/validation';
import type { TrailJourney, TrailReceipt } from '@wherego/domain';

// 계정별 기기 파일명을 고정한다.
function workspaceFile(scope: string): File {
  // 캐시가 아닌 앱 문서 디렉터리에 저장한다.
  return new File(
    Paths.document,
    `wherego-trail-${encodeURIComponent(scope)}.json`,
  );
}

// 플랫폼에 맞는 보존 저장소에서 읽는다.
export function readTrailWorkspace(scope: string): Promise<TrailJourney[]> {
  // 웹 정적 렌더링 중에는 브라우저 저장소를 접근하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(
        typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(`wherego-trail-${scope}`),
      ).then(parseWorkspace)
    : workspaceFile(scope).exists
      ? workspaceFile(scope).text().then(parseWorkspace)
      : Promise.resolve([]);
}

// 보존된 JSON 문서를 파싱한다.
function parseWorkspace(text: string | null): TrailJourney[] {
  // 잘못된 버전은 빈 기록으로 덮어쓰지 않고 읽기 오류를 전달한다.
  return text ? checkedWorkspace(JSON.parse(text)) : [];
}

// 데이터 형식 버전을 확인한다.
function checkedWorkspace(value: unknown): TrailJourney[] {
  // 외부 응답이 아닌 이 기능이 작성한 버전 1 문서만 읽는다.
  return workspaceSchema.parse(value).journeys.map((journey) => {
    // 앱 업데이트로 문서 디렉터리 경로가 바뀌어도 원본 파일명을 유지한다.
    return {
      ...journey,
      receipts: journey.receipts.map((receipt) => {
        // 해당 기능이 만든 네이티브 파일명만 현재 문서 경로로 다시 연결한다.
        return {
          ...receipt,
          attachment: resolveAttachment(receipt.attachment),
        };
      }),
    };
  });
}

// 저장된 원본 경로를 현재 앱 문서 경로로 확인한다.
function resolveAttachment(
  attachment: TrailReceipt['attachment'],
): TrailReceipt['attachment'] {
  // 웹 data URI와 다른 형식 경로는 임의로 변경하지 않는다.
  return Platform.OS !== 'web' &&
    /^trail-receipt-[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(
      attachment.uri.split('/').at(-1) ?? '',
    )
    ? {
        ...attachment,
        uri: new File(Paths.document, attachment.uri.split('/').at(-1) ?? '')
          .uri,
      }
    : attachment;
}

// 연결이 없는 이 기능의 원본 파일만 정리한다.
export function cleanupTrailAttachment(
  attachment: TrailReceipt['attachment'] | null,
  referenced: string[],
): Promise<void> {
  // 문서 폴더 밖의 파일이나 다른 기록이 참조하는 원본은 삭제하지 않는다.
  return Platform.OS === 'web' ||
    !attachment ||
    referenced.includes(attachment.uri) ||
    !isManagedAttachment(attachment)
    ? Promise.resolve()
    : deleteUnusedFile(new File(attachment.uri));
}

// 원본의 파일명과 최종 경로를 모두 대조한다.
function isManagedAttachment(attachment: TrailReceipt['attachment']): boolean {
  // 단순 경로 접두어만으로 삭제 대상을 판정하지 않는다.
  return (
    /^trail-receipt-[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(
      attachment.uri.split('/').at(-1) ?? '',
    ) &&
    attachment.uri ===
      new File(Paths.document, attachment.uri.split('/').at(-1) ?? '').uri
  );
}

// 존재하는 첨부 원본 하나만 제거한다.
function deleteUnusedFile(file: File): Promise<void> {
  // 이미 제거된 원본은 오류로 처리하지 않는다.
  return file.exists
    ? Promise.resolve().then(() => {
        // 동기 삭제 오류도 Promise 실패로 전달한다.
        return file.delete();
      })
    : Promise.resolve();
}

// 지원하지 않는 저장 데이터를 거부한다.
const attachmentSchema = z.object({
  name: z.string(),
  uri: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
});
// 버전과 실제 저장 객체의 모든 필드를 읽기 경계에서 검증한다.
const workspaceSchema = z.object({
  version: z.literal(1),
  journeys: z.array(
    trailJourneySchema.and(
      z.object({
        id: z.string().uuid(),
        sourceTripId: z.string().optional(),
        flights: z.array(
          trailFlightSchema.and(
            z.object({
              id: z.string().uuid(),
              source: z.literal('user-confirmed'),
            }),
          ),
        ),
        plans: z.array(
          trailPlanSchema.and(z.object({ id: z.string().uuid() })),
        ),
        receipts: z.array(
          trailReceiptSchema.and(
            z.object({
              id: z.string().uuid(),
              attachment: attachmentSchema,
              createdAt: z.string().datetime(),
            }),
          ),
        ),
      }),
    ),
  ),
});

// 저장 완료가 확인된 후 화면에 확정 상태를 반영하게 한다.
export function writeTrailWorkspace(
  scope: string,
  journeys: TrailJourney[],
): Promise<void> {
  // 비밀 토큰 없이 콘텐츠만 해당 계정 기기에 저장한다.
  return Platform.OS === 'web'
    ? Promise.resolve().then(() => {
        // 용량 부족 오류는 호출 화면에 전달한다.
        return localStorage.setItem(
          `wherego-trail-${scope}`,
          JSON.stringify({ version: 1, journeys }),
        );
      })
    : Promise.resolve().then(() => {
        // 네이티브 문서 파일 저장 오류도 숨기지 않는다.
        return workspaceFile(scope).write(
          JSON.stringify({ version: 1, journeys }),
        );
      });
}

// 이미지/PDF 원본을 사용자 파일 선택으로 가져온다.
export function pickTrailAttachment(): Promise<
  TrailReceipt['attachment'] | null
> {
  // 웹은 base64 원본, 네이티브는 즉시 읽을 수 있는 캐시 파일을 얻는다.
  return DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  }).then((result) => {
    // 취소는 오류나 빈 영수증 등록으로 처리하지 않는다.
    return result.canceled ? null : preserveAttachment(result.assets[0]);
  });
}

// 첨부 원본은 캐시 만료 이후에도 유지한다.
function preserveAttachment(
  asset?: DocumentPicker.DocumentPickerAsset,
): Promise<TrailReceipt['attachment']> {
  // 과도한 웹 저장 용량을 방지하고 선택한 지원 파일만 보존한다.
  return asset &&
    asset.size &&
    asset.size <= 2 * 1024 * 1024 &&
    ['image/jpeg', 'image/png', 'application/pdf'].includes(
      asset.mimeType ?? '',
    )
    ? Platform.OS === 'web'
      ? Promise.resolve(webAttachment(asset))
      : copyAttachment(asset).then((uri) => {
          // 실제 파일 복사가 끝난 뒤에만 영구 첨부 URI를 반환한다.
          return attachmentRecord(asset, uri);
        })
    : Promise.reject(new Error('2MB 이하 JPG·PNG·PDF 파일을 선택해 주세요.'));
}

// 웹 선택기의 임시 blob 대신 base64 원본을 보존한다.
function webAttachment(
  asset: DocumentPicker.DocumentPickerAsset,
): TrailReceipt['attachment'] {
  // 더 이상 사용하지 않는 blob 주소는 해제한다.
  return decodedAttachment(asset, URL.revokeObjectURL(asset.uri));
}

// 선택기가 제공한 원본 data URI를 반환한다.
function decodedAttachment(
  asset: DocumentPicker.DocumentPickerAsset,
  _revoked: void,
): TrailReceipt['attachment'] {
  // blob URL은 브라우저 재실행 후 유효하지 않다.
  return attachmentRecord(asset, asset.base64 ?? '');
}

// 웹 base64 또는 네이티브 문서 URI를 반환한다.
function attachmentRecord(
  asset: DocumentPicker.DocumentPickerAsset,
  uri: string,
): TrailReceipt['attachment'] {
  // 확인되지 않은 웹 blob URI는 영구 저장으로 표시하지 않는다.
  return Platform.OS !== 'web' || uri.startsWith('data:')
    ? { name: asset.name, uri, mimeType: asset.mimeType ?? 'application/pdf' }
    : invalidAttachment();
}

// 네이티브 원본을 영구 문서 파일로 복사한다.
function copyAttachment(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<string> {
  // 복사 명령 하나를 별도 함수로 위임한다.
  return copiedAttachment(
    new File(asset.uri),
    new File(
      Paths.document,
      `trail-receipt-${Crypto.randomUUID()}.${asset.mimeType === 'application/pdf' ? 'pdf' : asset.mimeType === 'image/png' ? 'png' : 'jpg'}`,
    ),
  );
}

// 복사 결과 URI를 저장 계약으로 전달한다.
function copiedAttachment(source: File, target: File): Promise<string> {
  // 캐시 파일을 기록 원본 경로로 복사한다.
  return source.copy(target).then(() => {
    // 복사가 실제 완료된 문서 경로만 반환한다.
    return target.uri;
  });
}

// 원본은 플랫폼에 맞는 다운로드 또는 공유 UI로 제공한다.
export function openTrailAttachment(
  attachment: TrailReceipt['attachment'],
): Promise<void> {
  // 웹에서 파일 URI 공유를 호출하지 않는다.
  return Platform.OS === 'web'
    ? Promise.resolve(downloadAttachment(attachment))
    : Sharing.shareAsync(attachment.uri, {
        mimeType: attachment.mimeType,
        dialogTitle: '영수증 원본',
      });
}

// 웹에서는 원본 파일을 브라우저에서 내려받게 한다.
function downloadAttachment(attachment: TrailReceipt['attachment']): void {
  // 보존한 data URI만 다운로드 링크로 사용한다.
  return activateDownload(
    Object.assign(document.createElement('a'), {
      href: attachment.uri,
      download: attachment.name,
    }),
  );
}

// 파일 링크 클릭 명령 하나를 실행한다.
function activateDownload(link: HTMLAnchorElement): void {
  // 원본을 외부 서버에 업로드하지 않는다.
  return link.click();
}

// 첨부 검증 실패를 사용자 메시지로 전달한다.
function invalidAttachment(): never {
  // 허용 형식과 크기를 구체적으로 안내한다.
  throw new Error('2MB 이하 JPG·PNG·PDF 파일을 선택해 주세요.');
}
