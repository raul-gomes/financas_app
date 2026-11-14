import { z } from 'zod';

/** `ProfileResponse`. */
export const profileSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  has_pluggy_key: z.boolean(),
  role: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** `BankResponse`. */
export const userBankSchema = z.object({
  id: z.number(),
  bank_code: z.string(),
  bank_name: z.string(),
  created_at: z.string(),
});

export const userBankListSchema = z.array(userBankSchema);

/** Public BrasilAPI `GET /banks/v1` item (`code` is numeric there). */
export const brasilApiBankSchema = z.object({
  code: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((code) => (code === null ? null : String(code))),
  name: z.string(),
  fullName: z.string(),
  ispb: z.string(),
});

export const brasilApiBankListSchema = z.array(brasilApiBankSchema);

/** `GET /pluggy/validate-key`. */
export const pluggyValidateSchema = z.object({ valid: z.boolean(), message: z.string() });

/** `GET /pluggy/accounts` (accounts are passed through from Meu Pluggy). */
export const pluggyAccountsSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      balance: z.number(),
      currencyCode: z.string(),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      institution_name: z.string(),
      institution_number: z
        .union([z.string(), z.number()])
        .nullish()
        .transform((value) => (value == null ? undefined : String(value))),
    }),
  ),
});

/** `POST /pluggy/sync`. */
export const syncResultSchema = z.object({
  message: z.string(),
  imported: z.number(),
  accounts: z.number().optional(),
});
