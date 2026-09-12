export type NotificationSeverity = 'warning' | 'critical' | 'destructive';

export interface NotificationItem {
  id: number;
  category_id: number;
  category_name: string;
  scope: 'category' | 'credit_card';
  month: string;
  threshold: number;
  percent_used: number;
  exceeded: boolean;
  created_at: string | null;
  read: boolean;
  severity: NotificationSeverity;
  message: string;
}

export interface NotificationsResponse {
  unread_count: number;
  items: NotificationItem[];
}

export interface MarkReadResponse {
  success: boolean;
  updated: number;
}

export interface CategoryRiskResponse {
  category_id: number;
  category_name: string;
  limit: number;
  spent: number;
  percent_used: number;
  is_over_limit: boolean;
}