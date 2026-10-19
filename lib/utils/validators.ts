import { z } from 'zod'

export const uuidSchema = z.string().uuid()
export const practiceSubmissionSchema = z.object({
  pdfId: uuidSchema,
  answers: z.record(z.union([z.string(), z.array(z.string())])),
  timeSpent: z.number().finite().int().nonnegative(),
})
export const pdfDeleteSchema = z.object({ pdfId: uuidSchema })
export const parseTimingSchema = z.object({
  runId: uuidSchema,
  endToEndMs: z.number().finite().nonnegative(),
})
