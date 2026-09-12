import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NotificationBell } from './NotificationBell';
import { NotificationsResponse } from '@/types/notifications';

const mockList = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock('@/services/notificationService', () => ({
  NotificationService: {
    listNotifications: (...args: unknown[]) => mockList(...args),
    markRead: (...args: unknown[]) => mockMarkRead(...args),
    markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
    checkCategoryRisk: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useSession: () => ({ session: { user: { id: 1 } }, user: null, loading: false }),
}));

const baseResponse: NotificationsResponse = {
  unread_count: 2,
  items: [
    {
      id: 1,
      category_id: 10,
      category_name: 'Alimentacao',
      scope: 'category',
      month: '2026-09',
      threshold: 70,
      percent_used: 85,
      exceeded: false,
      created_at: null,
      read: false,
      severity: 'warning',
      message: '"Alimentacao" está em 85% do limite',
    },
    {
      id: 2,
      category_id: 10,
      category_name: 'Alimentacao',
      scope: 'category',
      month: '2026-09',
      threshold: 100,
      percent_used: 110,
      exceeded: true,
      created_at: null,
      read: false,
      severity: 'destructive',
      message: '"Alimentacao" estourou o limite: 110% usado',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(baseResponse);
  mockMarkRead.mockResolvedValue({ success: true, updated: 1 });
  mockMarkAllRead.mockResolvedValue({ success: true, updated: 2 });
});

describe('NotificationBell', () => {
  it('mostra badge com contagem de não lidas', async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });
    const badge = screen.getByText('2');
    expect(badge).toBeTruthy();
  });

  it('abre o popover e lista os alertas com severidade', async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Alertas/ }));
    await waitFor(() => {
      expect(screen.getByText('Estourado')).toBeTruthy();
      expect(screen.getByText(/estourou o limite/)).toBeTruthy();
    });
    expect(screen.getByText('Alerta')).toBeTruthy();
  });

  it('marca uma notificação como lida', async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Alertas/ }));
    await waitFor(() => {
      expect(screen.getByText(/estourou o limite/)).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Marcar como lida/ })[0]);
    expect(mockMarkRead).toHaveBeenCalledWith(1);
  });

  it('marca todas como lidas', async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Alertas/ }));
    await waitFor(() => {
      expect(screen.getByText('Marcar todas')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Marcar todas/ }));
    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it('mostra estado vazio quando não há alertas', async () => {
    mockList.mockResolvedValue({ unread_count: 0, items: [] });
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText('Alertas')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Alertas/ }));
    await waitFor(() => {
      expect(screen.getByText(/Nenhum alerta/)).toBeTruthy();
    });
  });
});