import type { z, ZodTypeAny } from 'zod';

/**
 * Thrown when an API response does not match the expected schema.
 * The message lists only field paths and reasons, never the payload itself.
 */
export class ApiSchemaError extends Error {
  readonly context: string;

  constructor(context: string, detail: string) {
    super(`Resposta inesperada do servidor ao ${context}: ${detail}`);
    this.name = 'ApiSchemaError';
    this.context = context;
  }
}

/** Maximum number of schema issues listed in the error message. */
const MAX_REPORTED_ISSUES = 3;

/**
 * Validates an already-decoded JSON value against a schema, once, at the
 * boundary, and returns it typed as the domain type.
 *
 * @param schema - Zod schema describing the backend contract.
 * @param data - Decoded JSON value.
 * @param context - Human readable action ("buscar metas"), used in the error.
 * @throws ApiSchemaError when the value does not match the schema.
 */
export function parseApi<S extends ZodTypeAny>(schema: S, data: unknown, context: string): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data as z.infer<S>;
  const detail = result.error.issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('; ');
  throw new ApiSchemaError(context, detail);
}

/**
 * Reads the JSON body of a response and validates it against a schema.
 *
 * @throws ApiSchemaError when the body is not valid JSON or does not match.
 */
export async function parseResponse<S extends ZodTypeAny>(
  res: Response,
  schema: S,
  context: string,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiSchemaError(context, 'corpo da resposta não é JSON válido');
  }
  return parseApi(schema, body, context);
}
