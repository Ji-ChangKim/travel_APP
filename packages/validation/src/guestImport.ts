import { z } from 'zod';
import { decimalExpenseSchema, foundationUuidSchema } from './foundation';
import { workspaceSnapshotSchema } from './workspace';

// 기기 자료를 선택한 이용자만 원본 여행 단위로 연결하며 기존 서버 여행과 합치지 않는다.
export const guestImportInputSchema = z
  .object({
    guestContextRef: foundationUuidSchema,
    trip: workspaceSnapshotSchema,
  })
  .strict()
  .superRefine(({ guestContextRef, trip }, context) => {
    const dayIds = new Set(trip.days.map((day) => day.id));
    const destinationIds = new Set(
      (trip.trip.destinations || []).map((item) => item.id),
    );
    const scheduleIds = new Set(trip.itinerary.map((item) => item.id));
    const mediaIds = new Set(trip.media.map((item) => item.id));
    const identifiers = [
      trip.trip.id,
      ...trip.days.map((item) => item.id),
      ...trip.itinerary.map((item) => item.id),
      ...trip.expenses.map((item) => item.id),
      ...trip.checklists.map((item) => item.id),
      ...trip.media.map((item) => item.id),
      ...trip.receipts.map((item) => item.id),
    ];
    const valid =
      trip.trip.ownerId === guestContextRef &&
      trip.myRole === 'owner' &&
      trip.trip.startDate <= trip.trip.endDate &&
      dayIds.size === trip.days.length &&
      new Set(identifiers).size === identifiers.length &&
      trip.days.every(
        (day) =>
          day.dayNumber > 0 &&
          Number.isInteger(day.dayNumber) &&
          (!day.destinationId || destinationIds.has(day.destinationId)) &&
          day.tripDate >= trip.trip.startDate &&
          day.tripDate <= trip.trip.endDate,
      ) &&
      trip.itinerary.every((item) => dayIds.has(item.dayId)) &&
      (trip.travelLegs || []).every(
        (leg) =>
          dayIds.has(leg.dayId) &&
          scheduleIds.has(leg.fromScheduleId) &&
          scheduleIds.has(leg.toScheduleId),
      ) &&
      trip.expenses.every(
        (item) =>
          decimalExpenseSchema.safeParse({
            amount: item.amount,
            currency: item.currency,
          }).success &&
          (!item.dayId || dayIds.has(item.dayId)) &&
          (!item.scheduleId || scheduleIds.has(item.scheduleId)),
      ) &&
      trip.media.every(
        (item) => !item.scheduleId || scheduleIds.has(item.scheduleId),
      ) &&
      trip.receipts.every(
        (item) =>
          decimalExpenseSchema.safeParse({
            amount: item.amount,
            currency: item.currency,
          }).success &&
          scheduleIds.has(item.scheduleId) &&
          (!item.keepPhoto || mediaIds.has(item.mediaId)),
      );
    if (!valid)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '여행의 소유자와 연결된 기록을 확인해 주세요.',
      });
  });

export type GuestImportInput = z.infer<typeof guestImportInputSchema>;

export const guestImportResultSchema = z.object({
  operationId: foundationUuidSchema,
  state: z.enum(['pending', 'confirmed']),
  localTripId: foundationUuidSchema,
  serverTripId: foundationUuidSchema,
  tripVersion: z.number().int().positive(),
  idMap: z.record(foundationUuidSchema),
  media: z.array(
    z.object({
      localId: foundationUuidSchema,
      localPath: z.string(),
      serverId: foundationUuidSchema,
      path: z.string().nullable(),
    }),
  ),
  missingMediaIds: z.array(foundationUuidSchema),
});
export type GuestImportResult = z.infer<typeof guestImportResultSchema>;
