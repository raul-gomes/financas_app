import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiSchemaError } from '@/lib/parse';
import { FinancialService } from './financialService';
import { MetasService } from './goalsService';
import { NotificationService } from './notificationService';
import { OverviewService } from './overviewService';
import { ContaRecorrenteService } from './recurringAccountService';
import { SettingsService } from './settingsService';
import { ShoppingService } from './shoppingService';
import { ExtractoService } from './extractService';
import type { Transaction, FinancialSummary, LimitsUpdateResponse } from '@/types/financial';
import type { Meta, MetaProgresso } from '@/types/goals';
import type { ContaRecorrente } from '@/types/recurringAccount';
import type { ShoppingItem } from '@/types/shopping';
import type { OverviewResponse } from '@/types/overview';

const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

/** Resolves the next apiFetch call with a JSON body. */
function respondWith(body: unknown) {
  mockApiFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const transaction: Transaction = {
  id: 1,
  type: 'expense',
  amount: 10.5,
  description: 'Mercado',
  category_id: 1,
  subcategory_id: 2,
  category_name: 'Alimentacao',
  subcategory_name: 'Mercado',
  payment_method: 'pix',
  installment_number: null,
  total_installments: null,
  is_installment: false,
  bank_code: null,
  entity_type: 'individual',
  transaction_date: '2026-05-01T00:00:00',
  recurring_account_id: null,
};

const summary: FinancialSummary = {
  total_income: 100,
  total_expenses: 10.5,
  start_date: '01/05/2026',
  end_date: '31/05/2026',
  monthly_goal: 0,
  total_invested: 0,
  transactions: [transaction],
  credit_card_limit: 0,
  fixed_expenses: 0,
  variable_expenses: 10.5,
};

const range = { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) };

describe('FinancialService boundary', () => {
  it('parses a valid statement', async () => {
    respondWith(summary);
    await expect(FinancialService.getFinancialSummary(range)).resolves.toEqual(summary);
  });

  it('rejects a statement whose amount is a string', async () => {
    respondWith({ ...summary, total_income: '100.00' });
    await expect(FinancialService.getFinancialSummary(range)).rejects.toBeInstanceOf(ApiSchemaError);
  });

  it('rejects an unknown transaction type without leaking the payload', async () => {
    respondWith({ ...summary, transactions: [{ ...transaction, type: 'refund', description: 'segredo' }] });
    const error = await FinancialService.getFinancialSummary(range).catch((e: Error) => e);
    expect(error).toBeInstanceOf(ApiSchemaError);
    expect((error as Error).message).toContain('transactions.0.type');
    expect((error as Error).message).not.toContain('segredo');
  });

  it('parses the yearly performance, category breakdown and income lists', async () => {
    respondWith({ limit: 5, months: { janeiro: { income: 1, expense: 2 } } });
    await expect(FinancialService.getYearlyPerformance(2026)).resolves.toMatchObject({ limit: 5 });
    respondWith({
      start_date: '01/05/2026',
      end_date: '31/05/2026',
      categories: [{ name: 'A', total: 1, limit: 2, subcategories: [{ name: 'b', amount: '1.00' }] }],
    });
    await expect(FinancialService.getCategoryBreakdown(range)).resolves.toHaveProperty('categories');
    respondWith({ start_date: 'a', end_date: 'b', subcategories: [{ name: 'x', total: 3 }] });
    await expect(FinancialService.getCategoryIncome(range)).resolves.toHaveProperty('subcategories');
  });

  it('rejects a breakdown whose subcategory amount is a number', async () => {
    respondWith({
      start_date: 'a',
      end_date: 'b',
      categories: [{ name: 'A', total: 1, limit: 2, subcategories: [{ name: 'b', amount: 1 }] }],
    });
    await expect(FinancialService.getCategoryBreakdown(range)).rejects.toBeInstanceOf(ApiSchemaError);
  });

  it('parses category options and rejects a missing options list', async () => {
    respondWith({ options: [{ id: 1, name: 'A', type: null, subcategories: [{ id: 2, name: 'b' }] }] });
    await expect(FinancialService.getCategorySubcategories()).resolves.toHaveProperty('options');
    respondWith({});
    await expect(FinancialService.getCategorySubcategories()).rejects.toBeInstanceOf(ApiSchemaError);
  });

  it('parses the transactions page and rejects a non-page', async () => {
    respondWith({ items: [transaction], total: 1, limit: 30, has_more: false, next_cursor: null });
    await expect(FinancialService.getTransactionsPage({})).resolves.toMatchObject({ total: 1 });
    respondWith({ detail: 'x' });
    await expect(FinancialService.getTransactionsPage({})).rejects.toBeInstanceOf(ApiSchemaError);
  });

  it('parses duplicate checks and rejects a malformed result', async () => {
    respondWith({ results: [{ index: 0, has_duplicate: false, duplicates: [] }] });
    await expect(FinancialService.checkDuplicates({})).resolves.toHaveProperty('results');
    respondWith({ results: [{ index: 0, duplicates: [] }] });
    await expect(FinancialService.checkDuplicates({})).rejects.toBeInstanceOf(ApiSchemaError);
  });

  it('parses limits payloads and rejects a limit sent as string', async () => {
    const category = {
      id: 1,
      category_name: 'Mensal PF',
      entity_type: 'individual',
      limit: 1000,
      type: null,
      subcategories: [{ id: 3, subcategory_name: 'x', target_amount: null }],
    };
    respondWith([category]);
    await expect(FinancialService.getLimits()).resolves.toHaveLength(1);
    respondWith([{ ...category, limit: '1000' }]);
    await expect(FinancialService.getLimits()).rejects.toBeInstanceOf(ApiSchemaError);
  });

  it('parses limit updates and limits with spending', async () => {
    const update: LimitsUpdateResponse = {
      success: true,
      message: 'ok',
      created_categories: 0,
      updated_categories: 1,
      deleted_categories: 0,
      created_subcategories: 0,
      updated_subcategories: 0,
      errors: [],
    };
    respondWith(update);
    await expect(FinancialService.saveLimits({ new: [], modified: [] })).resolves.toEqual(update);
    respondWith({ ...update, errors: 'boom' });
    await expect(FinancialService.saveLimits({ new: [], modified: [] })).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({
      month: '2026-05',
      categories: [
        {
          id: 1, category_name: 'A', entity_type: 'individual', limit: 1, spent: 0, remaining: 1,
          percent_used: 0, subcategories: [{ id: 1, subcategory_name: 's', spent: 0, limit: null }],
        },
      ],
      total_limit: 1,
      total_spent: 0,
      total_remaining: 1,
    });
    await expect(FinancialService.getLimitsWithSpending(2026, 5)).resolves.toHaveProperty('categories');
    respondWith({ month: '2026-05' });
    await expect(FinancialService.getLimitsWithSpending(2026, 5)).rejects.toBeInstanceOf(ApiSchemaError);
  });
});

describe('MetasService boundary', () => {
  const meta: Meta = {
    id: 1, subcategory_name: 'Viagem', target_amount: 500, category_id: 9, completed: false, completed_at: null,
  };
  const progress: MetaProgresso = {
    subcategory_id: 1, subcategory_name: 'Viagem', target_amount: 500, current_amount: 100, progress: 20,
    completed: false, completed_at: null, entity_type: 'individual',
  };

  it('parses valid goals and progress', async () => {
    respondWith([meta]);
    await expect(MetasService.list()).resolves.toEqual([meta]);
    respondWith(meta);
    await expect(MetasService.create({ subcategory_name: 'Viagem', target_amount: 500 })).resolves.toEqual(meta);
    respondWith([progress]);
    await expect(MetasService.progresso(2026, 5)).resolves.toEqual([progress]);
  });

  it('rejects malformed goals', async () => {
    respondWith([{ ...meta, target_amount: '500' }]);
    await expect(MetasService.list()).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ id: 1 });
    await expect(MetasService.concluir(1)).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith([{ ...progress, progress: null }]);
    await expect(MetasService.progresso(2026, 5)).rejects.toBeInstanceOf(ApiSchemaError);
  });
});

describe('NotificationService boundary', () => {
  const item = {
    id: 1, category_id: 1, category_name: 'A', scope: 'category', month: '2026-05', threshold: 80,
    percent_used: 82.5, exceeded: false, created_at: null, read: false, severity: 'warning', message: 'm',
  };

  it('parses notifications, mark-read and risk responses', async () => {
    respondWith({ unread_count: 1, items: [item] });
    await expect(NotificationService.listNotifications()).resolves.toHaveProperty('unread_count', 1);
    respondWith({ success: true, updated: 1 });
    await expect(NotificationService.markRead(1)).resolves.toEqual({ success: true, updated: 1 });
    respondWith({
      category_id: 1, category_name: 'A', limit: 10, spent: 1, amount: 0, projected_spent: 1, percent_used: 10,
      projected_percent_used: 10, is_over_limit: false, severity: null, thresholds_hit: [],
    });
    await expect(NotificationService.checkCategoryRisk(1)).resolves.toHaveProperty('severity', null);
  });

  it('rejects malformed notification payloads', async () => {
    respondWith({ unread_count: 1, items: [{ ...item, severity: 'purple' }] });
    await expect(NotificationService.listNotifications()).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ success: 'yes' });
    await expect(NotificationService.markAllRead()).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ category_id: 1 });
    await expect(NotificationService.checkCategoryRisk(1)).rejects.toBeInstanceOf(ApiSchemaError);
  });
});

describe('OverviewService boundary', () => {
  const overview: OverviewResponse = {
    reference_month: '05/2026',
    entity_type: 'all',
    totals: { total_income: 1, total_expenses: 1, total_invested: 0, balance: 0 },
    month_progress: {
      day: 1, days_in_month: 31, percent: 0.03, income_up_to_today: 0, expenses_up_to_today: 0, balance: 0,
    },
    credit_card: { limit: 10, used: 1, remaining: 9, percent_used: 10 },
    categories_status: [],
    installments: [],
    recurring_accounts: [],
    goals: [],
    shopping: [],
  };

  it('parses a valid overview', async () => {
    respondWith(overview);
    await expect(OverviewService.getOverview(2026, 5)).resolves.toEqual(overview);
  });

  it('rejects an overview with a bad status or missing block', async () => {
    respondWith({ ...overview, categories_status: [{ id: 1, status: 'bad' }] });
    await expect(OverviewService.getOverview(2026, 5)).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ ...overview, totals: undefined });
    await expect(OverviewService.getOverview(2026, 5)).rejects.toBeInstanceOf(ApiSchemaError);
  });
});

describe('ContaRecorrenteService boundary', () => {
  const conta: ContaRecorrente = {
    id: 1, description: 'Netflix', amount: 55.9, due_day: 10, category_id: 1, subcategory_id: 2,
    category_name: 'Lazer', subcategory_name: 'Streaming', entity_type: 'individual', payment_method: 'credit',
    bank_code: null, start_date: '2026-01-01T00:00:00', end_date: null, active: true, total_installments: 12,
    remaining_installments: 8, current_installment: 5, is_ending_soon: false,
  };

  it('parses valid recurring accounts and generation result', async () => {
    respondWith([conta]);
    await expect(ContaRecorrenteService.getAll()).resolves.toEqual([conta]);
    respondWith(conta);
    await expect(ContaRecorrenteService.getById(1)).resolves.toEqual(conta);
    respondWith({ generated: 2, details: ['a', 'b'] });
    await expect(ContaRecorrenteService.generate(range.from, range.to)).resolves.toHaveProperty('generated', 2);
  });

  it('rejects malformed recurring accounts', async () => {
    respondWith([{ ...conta, amount: '55.9' }]);
    await expect(ContaRecorrenteService.getAll()).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ ...conta, entity_type: 'all' });
    await expect(ContaRecorrenteService.renew(1)).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ generated: 'x', details: [] });
    await expect(ContaRecorrenteService.generate(range.from, range.to)).rejects.toBeInstanceOf(ApiSchemaError);
  });
});

describe('ShoppingService boundary', () => {
  const item: ShoppingItem = {
    id: 1, name: 'Arroz', reference_month: '2026-05-01', checked: false, completed_at: null,
    created_at: '2026-05-01T10:00:00', entity_type: 'individual', is_recurring: false,
    recurrence_group_id: null, recurrence_end_date: null,
  };

  it('parses valid items and rejects malformed ones', async () => {
    respondWith([item]);
    await expect(ShoppingService.listByMonth('2026-05')).resolves.toEqual([item]);
    respondWith({ ...item, checked: 'no' });
    await expect(ShoppingService.update(1, { checked: true })).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith('oops');
    await expect(ShoppingService.create({ name: 'x', reference_month: '2026-05-01' })).rejects.toBeInstanceOf(ApiSchemaError);
  });
});

describe('SettingsService boundary', () => {
  const profile = {
    id: 1, name: 'Raul', email: 'r@example.com', has_pluggy_key: false, role: 'user',
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
  };

  it('parses profile, banks, pluggy accounts and sync', async () => {
    respondWith(profile);
    await expect(SettingsService.getProfile()).resolves.toEqual(profile);
    respondWith([{ id: 1, bank_code: '260', bank_name: 'Nu', created_at: '2026-01-01T00:00:00' }]);
    await expect(SettingsService.listBanks()).resolves.toHaveLength(1);
    respondWith({ valid: true, message: 'ok' });
    await expect(SettingsService.validatePluggyKey()).resolves.toEqual({ valid: true, message: 'ok' });
    respondWith({
      accounts: [{ id: 'a', name: 'CC', type: 'BANK', balance: 1.5, currencyCode: 'BRL' }],
      items: [{ id: 'i', status: 'UPDATED', institution_name: 'Nu', institution_number: 123 }],
    });
    const accounts = await SettingsService.listPluggyAccounts();
    expect(accounts.items[0].institution_number).toBe('123');
    respondWith({ message: 'ok', imported: 3, accounts: 1 });
    await expect(SettingsService.syncPluggy()).resolves.toHaveProperty('imported', 3);
  });

  it('rejects malformed settings payloads', async () => {
    respondWith({ ...profile, has_pluggy_key: 'no' });
    await expect(SettingsService.getProfile()).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ id: 1 });
    await expect(SettingsService.addBank({ bank_code: '1', bank_name: 'x' })).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ valid: 'yes' });
    await expect(SettingsService.validatePluggyKey()).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ accounts: 'none' });
    await expect(SettingsService.listPluggyAccounts()).rejects.toBeInstanceOf(ApiSchemaError);
  });
});

describe('ExtractoService boundary', () => {
  const upload = {
    total: 1, total_income: 0, total_expenses: 1, total_income_amount: 0, total_expenses_amount: 9.9,
    transactions: [
      { date: '01/05/2026', description: 'x', amount: 9.9, type: 'expense', category_id: null,
        subcategory_id: null, payment_method: null, entity_type: null },
    ],
  };

  it('parses the upload and normalises defaults', async () => {
    respondWith(upload);
    const [session] = await ExtractoService.uploadMultiple([new File(['x'], 'e.csv')]);
    expect(session.transactions[0].payment_method).toBe('pix');
    expect(session.transactions[0].entity_type).toBe('individual');
  });

  it('rejects a malformed upload and confirm response', async () => {
    respondWith({ ...upload, transactions: [{ date: 'x' }] });
    await expect(ExtractoService.upload(new File(['x'], 'e.csv'))).rejects.toBeInstanceOf(ApiSchemaError);
    respondWith({ created: 1, errors: 'none' });
    await expect(ExtractoService.confirm({ transactions: [] })).rejects.toBeInstanceOf(ApiSchemaError);
  });
});
