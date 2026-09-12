import { useState, useEffect, useCallback } from 'react';
import { NotificationService } from '@/services/notificationService';
import { NotificationItem, NotificationsResponse } from '@/types/notifications';
import { useSession } from '@/contexts/AuthContext';

const POLL_INTERVAL_MS = 30_000;

export function useLimitAlerts(poll = true) {
  const { session } = useSession();
  const [notifications, setNotifications] = useState<NotificationsResponse>({
    unread_count: 0,
    items: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await NotificationService.listNotifications();
      setNotifications(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar notificações');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
    if (!poll) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh, poll]);

  const markRead = useCallback(
    async (id: number) => {
      await NotificationService.markRead(id);
      setNotifications((prev) => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        items: prev.items.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      }));
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    await NotificationService.markAllRead();
    setNotifications((prev) => ({
      ...prev,
      unread_count: 0,
      items: prev.items.map((item) => ({ ...item, read: true })),
    }));
  }, []);

  const addLocal = useCallback((item: NotificationItem) => {
    setNotifications((prev) => ({
      ...prev,
      unread_count: item.read ? prev.unread_count : prev.unread_count + 1,
      items: [item, ...prev.items],
    }));
  }, []);

  return { notifications, loading, error, refresh, markRead, markAllRead, addLocal };
}