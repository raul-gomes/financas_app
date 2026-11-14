import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from './notificationService';

const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

class FakeResponse {
  ok: boolean;
  status: number;
  private body: unknown;
  constructor(body: unknown, ok = true, status = 200) {
    this.body = body;
    this.ok = ok;
    this.status = status;
  }
  async json() {
    return this.body;
  }
  async text() {
    return JSON.stringify(this.body);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationService', () => {
  it('busca notificações', async () => {
    mockApiFetch.mockResolvedValue(new FakeResponse({ unread_count: 3, items: [] }));
    const data = await NotificationService.listNotifications();
    expect(data.unread_count).toBe(3);
    expect(mockApiFetch).toHaveBeenCalledWith('/notifications/');
  });

  it('marca como lida via PUT', async () => {
    mockApiFetch.mockResolvedValue(new FakeResponse({ success: true, updated: 1 }));
    await NotificationService.markRead(42);
    expect(mockApiFetch).toHaveBeenCalledWith('/notifications/42/read', { method: 'PUT' });
  });

  it('marca todas como lidas via PUT', async () => {
    mockApiFetch.mockResolvedValue(new FakeResponse({ success: true, updated: 5 }));
    await NotificationService.markAllRead();
    expect(mockApiFetch).toHaveBeenCalledWith('/notifications/read-all', { method: 'PUT' });
  });

  it('busca risco da categoria com query string', async () => {
    mockApiFetch.mockResolvedValue(
      new FakeResponse({ category_id: 7, category_name: 'X', limit: 10, spent: 11, amount: 0, projected_spent: 11, percent_used: 110, projected_percent_used: 110, is_over_limit: true, severity: 'destructive', thresholds_hit: [80, 90, 100] }),
    );
    const risk = await NotificationService.checkCategoryRisk(7);
    expect(risk.is_over_limit).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledWith('/limits/risk-check?category_id=7');
  });
});