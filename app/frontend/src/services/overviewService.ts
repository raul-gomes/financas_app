import { apiFetch } from '@/lib/api';
import { parseResponse } from '@/lib/parse';
import { overviewResponseSchema } from '@/schemas/overview';
import { OverviewResponse } from '@/types/overview';

export class OverviewService {
  static async getOverview(
    year: number,
    month: number,
    entityType: 'individual' | 'business' | 'all' = 'all',
  ): Promise<OverviewResponse> {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
      entity_type: entityType,
    });
    const res = await apiFetch(`/dashboard/overview?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar overview`);
    return parseResponse(res, overviewResponseSchema, 'buscar overview');
  }
}