import type { ImperativeRouter } from 'expo-router';
import type { PlanForm } from '../../shared/model/forms';
import { rememberCreation } from './creationAuthHandoff';
import { continueFormAfterPreserving } from '../../schedule/ui/scheduleExitGuard';

export function requestCreationLogin(
  router: ImperativeRouter,
  form: PlanForm,
  step: string,
): void {
  const tripId = rememberCreation(form, step);
  continueFormAfterPreserving(() =>
    router.push({ pathname: '/login', params: { next: 'new-trip', tripId } }),
  );
}
