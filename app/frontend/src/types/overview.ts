import type { z } from 'zod';
import type { overviewResponseSchema } from '@/schemas/overview';

export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
export type TotaisOverview = OverviewResponse['totals'];
export type MonthProgressOverview = OverviewResponse['month_progress'];
export type CreditCardOverview = OverviewResponse['credit_card'];
export type CategoriaStatusOverview = OverviewResponse['categories_status'][number];
export type ParcelaMesOverview = OverviewResponse['installments'][number];
export type RecorrentePagarOverview = OverviewResponse['recurring_accounts'][number];
export type MetaOverviewItem = OverviewResponse['goals'][number];
export type CompraOverviewItem = OverviewResponse['shopping'][number];
