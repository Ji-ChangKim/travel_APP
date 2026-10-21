import { z } from 'zod';
import { foundationUuidSchema, tripDestinationsSchema } from './foundation';

export const travelModeSchema = z.enum(['WALK', 'DRIVE', 'TRANSIT']);
export const publicTravelLegSchema = z
  .object({
    fromScheduleId: foundationUuidSchema,
    toScheduleId: foundationUuidSchema,
    mode: travelModeSchema,
  })
  .strict();
export const travelLegSchema = z
  .object({
    dayId: foundationUuidSchema,
    fromScheduleId: foundationUuidSchema,
    toScheduleId: foundationUuidSchema,
    mode: travelModeSchema,
  })
  .strict()
  .refine((input) => input.fromScheduleId !== input.toScheduleId);

export const destinationsInputSchema = z
  .object({
    destinations: tripDestinationsSchema,
    assignments: z
      .array(
        z
          .object({
            dayId: foundationUuidSchema,
            destinationId: foundationUuidSchema,
          })
          .strict(),
      )
      .max(90),
  })
  .strict();

export const recommendationInputSchema = z
  .object({
    dayId: foundationUuidSchema,
    interest: z.enum(['sights', 'food', 'cafe', 'nature', 'culture']),
    pace: z.enum(['relaxed', 'balanced', 'active']),
  })
  .strict();

export const recommendationResultSchema = z.object({
  tripVersion: z.number().int().positive(),
  dayId: foundationUuidSchema,
  destinationId: foundationUuidSchema,
  generatedAt: z.string().datetime(),
  items: z
    .array(
      z.object({
        placeId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
        title: z.string().max(300),
        address: z.string().max(1000),
        reason: z.string().max(500),
        attributions: z
          .array(
            z.object({ provider: z.string(), providerUri: z.string().url() }),
          )
          .max(20),
      }),
    )
    .max(5),
});

export const routeEstimateSchema = z.object({
  tripVersion: z.number().int().positive().optional(),
  fromScheduleId: foundationUuidSchema,
  toScheduleId: foundationUuidSchema,
  mode: travelModeSchema,
  durationSeconds: z.number().finite().nonnegative(),
  distanceMeters: z.number().finite().nonnegative(),
  queriedAt: z.string().datetime(),
});
