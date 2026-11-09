import type { z } from 'zod';
import { InvalidDetectorParamsError, type DetectionParams } from './method';

/** Valida con el esquema del método; los errores de Zod se vuelven `InvalidDetectorParamsError`. */
export function parseParams<T extends DetectionParams>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  method: string,
  params: unknown,
): T {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(params)'}: ${issue.message}`)
      .join('; ');
    throw new InvalidDetectorParamsError(`Invalid params for ${method}: ${issues}`);
  }
  return parsed.data;
}
