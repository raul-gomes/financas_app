import type { z } from 'zod';
import type {
  notificationSeveritySchema,
  notificationItemSchema,
  notificationsResponseSchema,
  markReadResponseSchema,
  categoryRiskResponseSchema,
} from '@/schemas/notifications';

export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;
export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;
export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;
export type CategoryRiskResponse = z.infer<typeof categoryRiskResponseSchema>;
