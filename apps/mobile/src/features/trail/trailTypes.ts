import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TrailReceipt, Trip, Visit } from '@wherego/domain';
import type { useTrailStore } from './store';

// 편집 상태는 저장 객체와 분리해 화면이 열려 있는 동안에만 유지한다.
export type TrailEditor = 'journey' | 'flight' | 'plan' | 'receipt' | null;
type StatePair<T> = [T, Dispatch<SetStateAction<T>>];
export type TrailForm = Record<string, string>;

export interface TrailModel {
  scope: string;
  ownerId: string;
  state: ReturnType<typeof useTrailStore.getState>;
  sourceTrips: Trip[];
  legacyVisits: Visit[];
  active: StatePair<string>;
  editor: StatePair<TrailEditor>;
  form: StatePair<TrailForm>;
  attachment: StatePair<TrailReceipt['attachment'] | null>;
  notice: StatePair<string>;
  attachmentPending: StatePair<boolean>;
  editorSession: RefObject<{
    active: boolean;
    revision: number;
    picking: boolean;
  }>;
}
