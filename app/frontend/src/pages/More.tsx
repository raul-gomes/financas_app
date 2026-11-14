import type { LucideIcon } from 'lucide-react';
import { Bell, ChevronRight, Landmark, LogOut, Repeat, Settings, TrendingUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useRole } from '@/contexts/RoleContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MenuRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Shows a trailing chevron (navigation rows). */
  chevron?: boolean;
  destructive?: boolean;
}

const ROW_CLASS =
  'flex min-h-[56px] w-full items-center gap-3 border-t border-border text-left first:border-t-0';

/** Visual content of a menu row (icon tile, title/subtitle, chevron). */
function MenuRowContent({ icon: Icon, title, subtitle, chevron = false, destructive = false }: MenuRowProps) {
  return (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-muted">
        <Icon className={cn('h-5 w-5', destructive ? 'text-destructive' : 'text-primary')} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-semibold', destructive && 'text-destructive')}>{title}</span>
        {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
    </>
  );
}

/**
 * "Mais" page (mobile): menu with the pages that do not fit in the tab bar.
 * Admin-only entries follow the same UI gate as the routes themselves.
 */
export default function More() {
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out failed:', error);
      toast({ title: 'Erro', description: 'Não foi possível sair. Tente novamente.', variant: 'destructive' });
      return;
    }
    navigate('/login');
  };

  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 py-4">
      {isAdmin && (
        <div className="rounded-2xl border border-border bg-card px-4" data-testid="more-admin-group">
          <Link to="/recorrentes" className={ROW_CLASS}>
            <MenuRowContent icon={Repeat} title="Contas recorrentes" chevron />
          </Link>
          <Link to="/extrato-bancario" className={ROW_CLASS}>
            <MenuRowContent icon={Landmark} title="Extrato bancário" subtitle="Importar OFX/CSV" chevron />
          </Link>
          <Link to="/investments" className={ROW_CLASS}>
            <MenuRowContent icon={TrendingUp} title="Investimentos" chevron />
          </Link>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card px-4">
        <Link to="/configuracoes" className={ROW_CLASS}>
          <MenuRowContent icon={Settings} title="Configurações" subtitle="Perfil, senha, contas" chevron />
        </Link>
        <NotificationBell>
          <button type="button" className={ROW_CLASS}>
            <MenuRowContent icon={Bell} title="Notificações" chevron />
          </button>
        </NotificationBell>
        <button type="button" onClick={handleLogout} className={ROW_CLASS}>
          <MenuRowContent icon={LogOut} title="Sair" destructive />
        </button>
      </div>
    </div>
  );
}
