import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { ScrollView } from 'react-native';

import type { FieldErrors } from '../../shared/model/formFeedback';
import type { PlanForm } from '../../shared/model/forms';

import { type FlightSlot } from './tripFlightModel';

export type RenderTripPlanningProps = {
  step: string;
  recording: boolean;
  back: () => void;
  props: {
    onDraftPending: (pending: boolean) => void;
    onDraftSaved: (revision: number) => void;
    userId: string;
    form: PlanForm;
    locked: boolean;
    busy: boolean;
    error: string;
    onChange: (key: string, value: string) => void;
    onInvalid: (fields: FieldErrors) => void;
    onSave: () => void;
    onClose: () => void;
  };
  next: () => void;
  create: () => void;
  scroll: RefObject<ScrollView | null>;
  setBasicsError: Dispatch<SetStateAction<string>>;
  items: {
    number: string;
    departure: string;
    arrival: string;
    time: string;
    date: string;
    role: 'outbound' | 'inbound' | 'additional';
    departureTerminal?: string | undefined;
    arrivalTerminal?: string | undefined;
    arrivalTime?: string | undefined;
    arrivalDate?: string | undefined;
    durationMinutes?: number | undefined;
    baggageKg?: number | undefined;
    cabin?: string | undefined;
    aircraftType?: string | undefined;
    aircraftRegistration?: string | undefined;
  }[];
  setSlot: Dispatch<SetStateAction<FlightSlot | null>>;
  basicsError: string;
};
