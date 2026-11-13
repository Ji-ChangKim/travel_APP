import { useSyncExternalStore } from 'react';
import { languageLocales, readLanguage, type AppLanguage } from './localeModel';

const listeners = new Set<() => void>();
let current: AppLanguage = 'ko';
let restoration: Promise<void> | undefined;

export function getLanguage(): AppLanguage {
  return current;
}

export function getLocale(): string {
  return languageLocales[current];
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// 화면을 다시 마운트하지 않고 표시 문구만 갱신해 작성 중인 원본을 보존한다.
export function useLocale(): AppLanguage {
  return useSyncExternalStore(subscribe, getLanguage, () => 'ko');
}

function publish(language: AppLanguage): void {
  current = language;
  listeners.forEach((listener) => listener());
}

function detectDeviceLanguage(): AppLanguage {
  if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT) {
    return 'ko';
  }
  try {
    const raw =
      (typeof navigator !== 'undefined' && navigator.language) ||
      Intl.DateTimeFormat().resolvedOptions().locale ||
      '';
    const lower = raw.toLowerCase();
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('en')) return 'en';
  } catch {
    // 기기 로케일 조회 실패 시 한국어를 기본값으로 사용한다.
  }
  return 'ko';
}

// 계정과 독립된 기기 설정 한 개만 읽는다. 저장된 설정이 없으면 기기 언어를 따른다.
export function restoreLanguage(): Promise<void> {
  restoration ??= Promise.resolve().then(async () => {
    try {
      const { readStoredLanguage } = await import('./localeStorage');
      const value = await readStoredLanguage();
      publish(value ? readLanguage(value) : detectDeviceLanguage());
    } catch {
      publish(detectDeviceLanguage());
    }
  });
  return restoration;
}

// 실제 저장이 끝난 뒤 선택을 반영하며 저장 실패를 성공으로 표시하지 않는다.
export async function changeLanguage(language: AppLanguage): Promise<void> {
  await restoreLanguage();
  const { writeStoredLanguage } = await import('./localeStorage');
  await writeStoredLanguage(language);
  publish(language);
}
