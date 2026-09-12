import { apiFetch } from '@/lib/api';
import {
  NotificationsResponse,
  MarkReadResponse,
  CategoryRiskResponse,
} from '@/types/notifications';

export class NotificationService {
  static async listNotifications(): Promise<NotificationsResponse> {
    const res = await apiFetch('/notifications/');
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar notificações`);
    return res.json();
  }

  static async markRead(id: number): Promise<MarkReadResponse> {
    const res = await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao marcar notificação como lida`);
    return res.json();
  }

  static async markAllRead(): Promise<MarkReadResponse> {
    const res = await apiFetch('/notifications/read-all', { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao marcar notificações como lidas`);
    return res.json();
  }

  static async checkCategoryRisk(categoryId: number): Promise<CategoryRiskResponse> {
    const res = await apiFetch(`/limits/risk-check?category_id=${categoryId}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao verificar risco da categoria`);
    return res.json();
  }
}