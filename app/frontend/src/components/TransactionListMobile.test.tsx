import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { TransactionListMobile } from './TransactionListMobile';
import type { Transaction, TransactionPage } from '@/types/financial';

const mockGetTransactionsPage = vi.fn();
const mockListBanks = vi.fn();
const mockIsAdmin = vi.fn(() => false);

vi.mock('@/services/financialService', () => ({
  TRANSACTIONS_PAGE_SIZE: 30,
  FinancialService: {
    getTransactionsPage: (...args: unknown[]) => mockGetTransactionsPage(...args),
  },
}));

vi.mock('@/services/settingsService', () => ({
  SettingsService: { listBanks: () => mockListBanks() },
}));

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: mockIsAdmin() }),
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/components/dialogs/EditTransactionDialog', () => ({
  EditTransactionDialog: ({ transaction }: { transaction: Transaction }) => (
    <div role="dialog" aria-label="Editar Transação">{`editando ${transaction.id}`}</div>
  ),
}));
vi.mock('@/components/dialogs/ExtratoUploadModal', () => ({
  ExtratoUploadModal: () => null,
}));

function tx(id: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amount: 55.9,
    description: `Compra ${id}`,
    category_id: 1,
    subcategory_id: 1,
    category_name: 'Lazer',
    subcategory_name: 'Streaming',
    payment_method: 'pix',
    installment_number: null,
    total_installments: null,
    is_installment: false,
    bank_code: null,
    entity_type: 'individual',
    transaction_date: '2026-11-14T00:00:00',
    recurring_account_id: null,
    ...overrides,
  };
}

function page(items: Transaction[]): TransactionPage {
  return { items, total: items.length, limit: 30, has_more: false, next_cursor: null };
}

const baseProps = {
  onEditTransaction: vi.fn(),
  onDeleteTransaction: vi.fn(),
  dateRange: { from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) },
  selectedEntityType: 'pf' as const,
  onEntityTypeChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0));
  mockListBanks.mockResolvedValue([]);
  mockIsAdmin.mockReturnValue(false);
  baseProps.onDeleteTransaction.mockResolvedValue(undefined);
  mockGetTransactionsPage.mockResolvedValue(
    page([
      tx(1, { description: 'Streaming Netflix Premium' }),
      tx(2, { description: 'Salário', type: 'income', amount: 10120, category_name: 'Income', payment_method: 'pix' }),
      tx(3, { description: 'Conta de luz', transaction_date: '2026-11-12T00:00:00', recurring_account_id: 9 }),
    ]),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TransactionListMobile', () => {
  it('groups the rows by day under pt-BR headings', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Streaming Netflix Premium')).toBeTruthy());
    expect(screen.getByText('Hoje · 14 nov')).toBeTruthy();
    expect(screen.getByText('12 nov')).toBeTruthy();
  });

  it('shows a signed, colored amount and category with payment method', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    const income = screen.getByTestId('amount-2');
    expect(income.textContent).toMatch(/^\+R\$\s10\.120,00$/);
    expect(income.className).toContain('text-success');
    const expense = screen.getByTestId('amount-1');
    expect(expense.textContent).toMatch(/^−R\$\s55,90$/);
    expect(expense.className).toContain('text-destructive');
    expect(screen.getByText('Receita · Pix')).toBeTruthy();
    expect(screen.getByText('Lazer · Recorrente')).toBeTruthy();
  });

  it('has no delete button on the rows', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Excluir transação' })).toBeNull();
  });

  it('opens a detail sheet with Editar and Excluir when a row is tapped', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Salário/ }));

    const sheet = await screen.findByRole('dialog', { name: 'Salário' });
    expect(within(sheet).getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Excluir' })).toBeTruthy();
  });

  it('asks for confirmation before deleting and then deletes by id', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Salário/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Salário' });

    fireEvent.click(within(sheet).getByRole('button', { name: 'Excluir' }));

    expect(baseProps.onDeleteTransaction).not.toHaveBeenCalled();
    const confirm = await screen.findByRole('dialog', { name: 'Excluir esta transação?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(baseProps.onDeleteTransaction).toHaveBeenCalledWith(2));
  });

  it('does not delete when the confirmation is cancelled', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Salário/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Salário' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Excluir' }));
    const confirm = await screen.findByRole('dialog', { name: 'Excluir esta transação?' });

    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));

    expect(baseProps.onDeleteTransaction).not.toHaveBeenCalled();
  });

  it('opens the edit dialog from the sheet', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Salário/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Salário' });

    fireEvent.click(within(sheet).getByRole('button', { name: 'Editar' }));

    expect(await screen.findByText('editando 2')).toBeTruthy();
  });

  it('switches PF/PJ with the segmented control', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: 'PJ' }));
    expect(baseProps.onEntityTypeChange).toHaveBeenCalledWith('pj');
  });

  it('offers Ambos (both natures) and marks it when selected', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} selectedEntityType="all" />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    expect(screen.getByRole('radio', { name: 'Ambos' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'PF' }));
    expect(baseProps.onEntityTypeChange).toHaveBeenCalledWith('pf');
  });

  it('offers the statement import only to admins', async () => {
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Extrato/ })).toBeNull();
  });

  it('shows the Extrato action for admins', async () => {
    mockIsAdmin.mockReturnValue(true);
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Salário')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Extrato/ })).toBeTruthy();
  });

  it('shows the empty state', async () => {
    mockGetTransactionsPage.mockResolvedValue(page([]));
    renderWithQuery(<TransactionListMobile {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Nenhuma transação encontrada')).toBeTruthy());
  });
});
