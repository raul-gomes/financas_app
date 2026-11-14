import type { Infer } from '@/lib/parse';
import type {
  notificationSeveritySchema,
  notificationItemSchema,
  notificationsResponseSchema,
  markReadResponseSchema,
  categoryRiskResponseSchema,
} from '@/schemas/notifications';

export type NotificationSeverity = Infer<typeof notificationSeveritySchema>;
export type NotificationItem = Infer<typeof notificationItemSchema>;
export type NotificationsResponse = Infer<typeof notificationsResponseSchema>;
export type MarkReadResponse = Infer<typeof markReadResponseSchema>;
export type CategoryRiskResponse = Infer<typeof categoryRiskResponseSchema>;
