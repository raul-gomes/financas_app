import { z } from 'zod';

export const notificationSeveritySchema = z.enum(['warning', 'critical', 'destructive']);

/** `NotificationItem`. */
export const notificationItemSchema = z.object({
  id: z.number(),
  category_id: z.number(),
  category_name: z.string(),
  scope: z.enum(['category', 'credit_card']),
  month: z.string(),
  threshold: z.number(),
  percent_used: z.number(),
  exceeded: z.boolean(),
  created_at: z.string().nullable(),
  read: z.boolean(),
  severity: notificationSeveritySchema,
  message: z.string(),
});

/** `NotificationsResponse`. */
export const notificationsResponseSchema = z.object({
  unread_count: z.number(),
  items: z.array(notificationItemSchema),
});

/** `MarkReadResponse`. */
export const markReadResponseSchema = z.object({
  success: z.boolean(),
  updated: z.number(),
});

/** `CategoryRiskResponse`. */
export const categoryRiskResponseSchema = z.object({
  category_id: z.number(),
  category_name: z.string(),
  limit: z.number(),
  spent: z.number(),
  amount: z.number(),
  projected_spent: z.number(),
  percent_used: z.number(),
  projected_percent_used: z.number(),
  is_over_limit: z.boolean(),
  severity: notificationSeveritySchema.nullable(),
  thresholds_hit: z.array(z.number()),
});
