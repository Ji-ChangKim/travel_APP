import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';
import type { WorkspaceSnapshot } from '@wherego/domain';
import type { PlanForm } from '../../forms';
export type ScheduleEditorProps = {
  userId: string;
  form: PlanForm;
  snapshot: WorkspaceSnapshot;
  busy: boolean;
  locked: boolean;
  scroll: RefObject<ScrollView | null>;
  error: string;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
  onReload: () => void;
  onClose: () => void;
  onReceipt: (camera: boolean) => void;
};
export type ScheduleEditorFieldProps = Pick<
  ScheduleEditorProps,
  'snapshot' | 'form' | 'busy' | 'locked' | 'onChange'
>;
