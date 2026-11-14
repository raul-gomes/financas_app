import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLimitAlerts } from '@/hooks/useLimitAlerts';
import { NotificationItem } from '@/types/notifications';
import { cn } from '@/lib/utils';

const severityClasses: Record<string, string> = {
  warning: 'bg-warning/15 text-warning',
  critical: 'bg-critical/15 text-critical',
  destructive: 'bg-destructive/15 text-destructive',
};

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: (id: number) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md p-2 transition-colors',
        !item.read && 'bg-primary/5',
      )}
    >
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm leading-snug text-foreground',
            !item.read && 'font-medium',
          )}
        >
          {item.message}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.scope === 'credit_card' ? 'Cartão de crédito' : item.category_name}
          {' · '}
          {item.month}
        </p>
      </div>
      {!item.read && (
        <button
          type="button"
          onClick={() => onRead(item.id)}
          className="text-xs text-primary hover:underline shrink-0"
          aria-label={`Marcar como lida: ${item.message}`}
        >
          Lida
        </button>
      )}
    </div>
  );
}

export function NotificationBell() {
  const { notifications, loading, error, refresh, markRead, markAllRead } = useLimitAlerts();
  const unreadCount = notifications.unread_count;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative flex items-center gap-1">
          {unreadCount > 0 ? (
            <>
              <BellRing className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]" variant="destructive">
                {unreadCount}
              </Badge>
            </>
          ) : (
            <Bell className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Alertas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notificações</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          ) : error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : notifications.items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhum alerta de limite por enquanto.
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-border p-2.5"
                >
                  <Badge
                    className={cn('mb-1', severityClasses[item.severity])}
                    variant="outline"
                  >
                    {item.severity === 'destructive'
                      ? 'Estourado'
                      : item.severity === 'critical'
                        ? 'Crítico'
                        : 'Alerta'}
                  </Badge>
                  <NotificationRow item={item} onRead={markRead} />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="px-4 py-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={refresh}
          >
            Atualizar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}