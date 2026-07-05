import { z } from 'zod';

export const bugReportPinSchema = z.object({
  comment: z.string(),
  sourceFile: z.string().nullable(),
  componentPath: z.string().nullable(),
  selector: z.string(),
});

export const bugReportContextSchema = z.object({
  url: z.string(),
  title: z.string(),
  userAgent: z.string(),
  screenSize: z.string(),
  consoleErrors: z.array(
    z.object({
      type: z.enum(['error', 'warn', 'exception']),
      message: z.string(),
      time: z.string(),
    })
  ),
  collectedAt: z.string(),
});

export const bugReportInputSchema = z.object({
  title: z.string(),
  did: z.string(),
  expected: z.string(),
  got: z.string(),
  pins: z.array(bugReportPinSchema).max(20),
  debugContext: bugReportContextSchema,
});

export const bugReportOutputSchema = z.object({
  success: z.boolean(),
  issueUrl: z.string(),
  issueNumber: z.number(),
});
