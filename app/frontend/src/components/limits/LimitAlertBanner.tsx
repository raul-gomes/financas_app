import { formatCurrency } from '@/lib/format'
import type { LimitAlert } from './limitsModel'

const BANNER_STYLES = {
    warning: 'bg-warning/15 text-warning border-warning/30',
    critical: 'bg-critical/15 text-critical border-critical/30',
    destructive: 'bg-destructive/15 text-destructive border-destructive/30',
} as const

interface LimitAlertBannerProps {
    categoryName: string
    alert: LimitAlert
}

/** Pre-save warning: the typed limit would leave the category at `alert.percent`% of use this month. */
export function LimitAlertBanner({ categoryName, alert }: LimitAlertBannerProps) {
    const suffix = alert.severity === 'destructive' ? ' (estoura agora!)' : alert.severity === 'critical' ? ' (crítico)' : ''
    return (
        <div
            data-testid={`limit-alert-${categoryName.trim().toLowerCase()}`}
            data-severity={alert.severity}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${BANNER_STYLES[alert.severity]}`}
        >
            Este limite deixará "{categoryName}" com {alert.percent}% de uso neste mês
            ({formatCurrency(alert.spent)} gastos){suffix}.
        </div>
    )
}
