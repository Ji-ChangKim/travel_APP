import { useRef, useState } from 'react';
import type { sendWorkspaceCommand } from '@wherego/api-client';
import { newTripForm, type PlanForm } from '../../shared/model/forms';
import type { FormFeedbackState } from '../../shared/model/formFeedback';
import type { WorkspaceConfirmation } from '../model/workspaceConfirmation';
import { useScheduleExitGuard } from '../../schedule/ui/scheduleExitGuard';

// 폼·확인·재시도 참조는 같은 편집 화면의 수명 동안 보존한다.
export function useWorkspaceEditorState({
  creating,
  destination,
  mode,
  initialForm,
}: {
  creating: boolean;
  destination?: string;
  mode?: string;
  initialForm?: PlanForm;
}) {
  const [form, setForm] = useState<PlanForm | null>(
    creating
      ? () => initialForm || newTripForm(destination, mode === 'record')
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirmation, setConfirmation] =
    useState<WorkspaceConfirmation | null>(null);
  const confirming = useRef<null | {
    details: WorkspaceConfirmation;
    fromForm: boolean;
    after?: (
      result: Awaited<ReturnType<typeof sendWorkspaceCommand>>,
    ) => Promise<unknown>;
  }>(null);
  const [showReceiptCapture, setShowReceiptCapture] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  useScheduleExitGuard(
    form,
    busy || draftSaving || scanning || hasPending || Boolean(confirmation),
    setForm,
  );
  const [error, setError] = useState('');
  const [conflicted, setConflicted] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedbackState>({
    fields: {},
    attempt: 0,
  });
  const [checklistError, setChecklistError] = useState('');
  const [checklist, setChecklist] = useState('');
  const pending = useRef<null | (() => Promise<unknown>)>(null);
  const pendingRebase = useRef<
    null | ((version: number) => () => Promise<unknown>)
  >(null);
  const pendingUsesForm = useRef(false);
  const running = useRef(false);
  const conflict = useRef(false);

  return {
    form,
    setForm,
    busy,
    setBusy,
    draftSaving,
    setDraftSaving,
    scanning,
    setScanning,
    confirmation,
    setConfirmation,
    confirming,
    showReceiptCapture,
    setShowReceiptCapture,
    hasPending,
    setHasPending,
    error,
    setError,
    conflicted,
    setConflicted,
    feedback,
    setFeedback,
    checklistError,
    setChecklistError,
    checklist,
    setChecklist,
    pending,
    pendingRebase,
    pendingUsesForm,
    running,
    conflict,
  };
}
