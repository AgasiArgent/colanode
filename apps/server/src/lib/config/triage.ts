import { z } from 'zod/v4';

import { resolveOptionalConfigReference } from './utils';

export const triageConfigSchema = z
  .object({
    serviceToken: z
      .string()
      .optional()
      .transform(resolveOptionalConfigReference),
  })
  .prefault({});

export type TriageConfig = z.infer<typeof triageConfigSchema>;
