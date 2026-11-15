import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { renderWithQuery } from '@/test/queryWrapper';
import { queryKeys } from '@/lib/queryKeys';
import type { SessionData } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';
import BankExtract from './BankExtract';

const mockCategories = vi.fn();
const mockCheckDuplicates = vi.fn();
const mockDeleteTransaction = vi.fn();
const mockListBanks = vi.fn();
const mockAddBank = vi.fn();
const mockUpload = vi.fn();
const mockConfirm = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/financialService', () => ({
  TRANSACTIONS_PAGE_SIZE: 30,
  FinancialService: {
    getCategorySubcategories: (...args: unknown[]) => mockCategories(...args),
    checkDuplicates: (...args: unknown[]) => mockCheckDuplicates(...args),
    deleteTransaction: (...args: unknown[]) => mockDeleteTransaction(...args),
  },
}));

vi.mock('@/services/settingsService', () => ({
  SettingsService: {
    listBanks: (...args: unknown[]) => mockListBanks(...args),
    addBank: (...args: unknown[]) => mockAddBank(...args),
  },
}));

vi.mock('@/services/extractService', () => ({
  ExtractoService: {
    uploadMultiple: (...args: unknown[]) => mockUpload(...args),
    confirm: (...args: unknown[]) => mockConfirm(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const categories: CategorySubcategories = {
  options: [
    { id: 1, name: 'Alimentacao', type: 'expense', subcategories: [{ id: 11, name: 'Mercado' }] },
    { id: 2, name: 'Salario', type: 'income', subcategories: [{ id: 21, name: 'Mensal' }] },
  ],
};

const nubank = { id: 1, bank_code: '260', bank_name: 'Nubank', created_at: '2026-01-01T00:00:00' };

function makeSession(): SessionData {
  return {
    filename: 'extrato.csv',
    bankCode: '',
    isConfirmed: false,
    transactions: [
      { date: '15/03/2026', description: 'Mercado do bairro', amount: 100, type: 'expense', payment_method: 'pix', entity_type: 'individual' },
      { date: '16/03/2026', description: 'Salario marco', amount: 3000, type: 'income', payment_method: 'pix', entity_type: 'individual' },
    ],
  };
}

function renderPage(sessions?: SessionData[]) {
  return renderWithQuery(
    <MemoryRouter initialEntries={[{ pathname: '/extrato-bancario', state: sessions ? { sessions } : undefined }]}>
      <Routes>
        <Route path="/extrato-bancario" element={<BankExtract />} />
        <Route path="/financial" element={<div>financial-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The Radix Select answers deterministically to the keyboard in jsdom: Enter opens, Enter picks. */
async function pickOption(combobox: HTMLElement, name: string | RegExp) {
  fireEvent.focus(combobox);
  fireEvent.keyDown(combobox, { key: 'Enter' });
  const option = await screen.findByRole('option', { name });
  fireEvent.keyDown(option, { key: 'Enter' });
}

function rowOf(description: string): HTMLElement {
  return screen.getByDisplayValue(description).closest('tr') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCategories.mockResolvedValue(categories);
  mockListBanks.mockResolvedValue([nubank]);
  mockCheckDuplicates.mockResolvedValue({ results: [] });
  mockConfirm.mockResolvedValue({ created: 2, errors: [] });
  mockDeleteTransaction.mockResolvedValue(undefined);
});

describe('BankExtract - data loading (react-query)', () => {
  it('loads categories and banks once through the shared cache', async () => {
    const { client } = renderPage();

    await waitFor(() => expect(mockCategories).toHaveBeenCalledTimes(1));
    expect(mockCategories).toHaveBeenCalledWith('all', undefined);
    await waitFor(() => expect(client.getQueryData(queryKeys.settings.banks())).toEqual([nubank]));
    expect(mockListBanks).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKeys.financial.categoryOptions('all'))).toEqual(categories);
  });

  it('refreshes both lists when the global "+" add invalidates every query', async () => {
    const { client } = renderPage();
    await waitFor(() => expect(mockListBanks).toHaveBeenCalledTimes(1));

    await client.invalidateQueries();

    await waitFor(() => expect(mockListBanks).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockCategories).toHaveBeenCalledTimes(2));
  });

  it('warns the user when categories or banks fail to load', async () => {
    mockCategories.mockRejectedValue(new Error('boom'));
    mockListBanks.mockRejectedValue(new Error('boom'));

    renderPage();

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(2));
    const descriptions = mockToast.mock.calls.map(([options]) => options.description);
    expect(descriptions).toContain('Falha ao carregar as categorias.');
    expect(descriptions).toContain('Falha ao carregar os bancos.');
  });
});

describe('BankExtract - upload step', () => {
  it('shows the drop zone when there is nothing to review', () => {
    renderPage();
    expect(screen.getByText('Arraste os arquivos aqui ou clique para selecionar')).toBeInTheDocument();
  });

  it('uploads the chosen files, checks duplicates and moves to the review', async () => {
    mockUpload.mockResolvedValue([makeSession()]);
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'extrato.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Revisar Extrato')).toBeInTheDocument();
    expect(mockUpload).toHaveBeenCalledWith([file]);
    expect(mockCheckDuplicates).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Mercado do bairro')).toBeInTheDocument();
  });

  it('keeps every row when the duplicate check fails', async () => {
    mockUpload.mockResolvedValue([makeSession()]);
    mockCheckDuplicates.mockRejectedValue(new Error('boom'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'extrato.csv')] },
    });

    expect(await screen.findByDisplayValue('Salario marco')).toBeInTheDocument();
    expect(logged).toHaveBeenCalled();
  });

  it('tells the user when the file cannot be processed', async () => {
    mockUpload.mockRejectedValue(new Error('formato'));
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'extrato.csv')] },
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringContaining('Falha ao processar o extrato') }),
      ),
    );
  });
});

describe('BankExtract - review', () => {
  it('summarises the counts and totals of every session', async () => {
    renderPage([makeSession()]);

    expect(await screen.findByText('Revisar Extrato')).toBeInTheDocument();
    expect(screen.getByText('1 arquivo — 2 transações')).toBeInTheDocument();
    expect(screen.getByText('Total').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Entradas').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Saídas').nextElementSibling?.textContent).toBe('1');
  });

  it('removes a row from the review', async () => {
    renderPage([makeSession()]);
    await screen.findByDisplayValue('Mercado do bairro');

    fireEvent.click(within(rowOf('Mercado do bairro')).getByRole('button', { name: 'Remover transação' }));

    expect(screen.queryByDisplayValue('Mercado do bairro')).toBeNull();
    expect(screen.getByText('1 arquivo — 1 transações')).toBeInTheDocument();
  });

  it('lists the duplicates found at the top and drops them from the session', async () => {
    mockCheckDuplicates.mockResolvedValue({
      results: [
        {
          index: 0,
          has_duplicate: true,
          duplicates: [
            { id: 77, description: 'Mercado antigo', amount: 100, transaction_date: '2026-03-15', type: 'expense', entity_type: 'individual' },
          ],
        },
      ],
    });

    renderPage([makeSession()]);

    expect(await screen.findByText('Transações Duplicadas Detectadas')).toBeInTheDocument();
    expect(screen.getByText('(1 pendentes)')).toBeInTheDocument();
    expect(screen.getByText('Mercado antigo')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Mercado do bairro')).toBeNull();
    expect(screen.getByDisplayValue('Salario marco')).toBeInTheDocument();
    expect(mockCheckDuplicates.mock.calls[0][0]).toEqual({
      transactions: [
        { index: 0, transaction_date: '2026-03-15', amount: 100 },
        { index: 1, transaction_date: '2026-03-16', amount: 3000 },
      ],
    });
  });

  it('replacing a duplicate deletes the existing one, refreshes the data and re-adds the row', async () => {
    mockCheckDuplicates.mockResolvedValue({
      results: [
        {
          index: 0,
          has_duplicate: true,
          duplicates: [
            { id: 77, description: 'Mercado antigo', amount: 100, transaction_date: '2026-03-15', type: 'expense', entity_type: 'individual' },
          ],
        },
      ],
    });
    const { client } = renderPage([makeSession()]);
    await screen.findByText('Transações Duplicadas Detectadas');
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }));

    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledWith(77));
    expect(await screen.findByDisplayValue('Mercado do bairro')).toBeInTheDocument();
    expect(screen.getByText('✓ Substituído')).toBeInTheDocument();
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(queryKeys.transactions.all);
  });

  it('keeping the existing duplicate only marks it as ignored', async () => {
    mockCheckDuplicates.mockResolvedValue({
      results: [
        {
          index: 1,
          has_duplicate: true,
          duplicates: [
            { id: 78, description: 'Salario antigo', amount: 3000, transaction_date: '2026-03-16', type: 'income', entity_type: 'individual' },
          ],
        },
      ],
    });
    renderPage([makeSession()]);
    await screen.findByText('Transações Duplicadas Detectadas');

    fireEvent.click(screen.getByRole('button', { name: 'Manter existente' }));

    expect(screen.getByText('✓ Ignorado')).toBeInTheDocument();
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
  });
});

describe('BankExtract - confirmation', () => {
  it('cannot confirm a session before a bank is chosen', async () => {
    renderPage([makeSession()]);
    await screen.findByText('Revisar Extrato');

    expect(screen.getByRole('button', { name: /^Confirmar$/ })).toBeDisabled();
  });

  it('blocks the confirmation and counts the errors while rows lack a category', async () => {
    renderPage([makeSession()]);
    await screen.findByText('Revisar Extrato');
    await waitFor(() => expect(mockListBanks).toHaveBeenCalled());
    const bankSelect = screen.getAllByRole('combobox')[0];
    await pickOption(bankSelect, /Nubank/);

    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/ }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Validação', description: 'Corrija os 2 erro(s) antes de confirmar.' }),
      ),
    );
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('2 transação(ões) sem categoria')).toBeInTheDocument();
  });

  it('confirms the session with the filled rows, refreshes the data and returns to /financial', async () => {
    const { client } = renderPage([makeSession()]);
    await screen.findByText('Revisar Extrato');
    await waitFor(() => expect(mockCategories).toHaveBeenCalled());
    await waitFor(() => expect(client.getQueryData(queryKeys.financial.categoryOptions('all'))).toBeDefined());

    await pickOption(screen.getAllByRole('combobox')[0], /Nubank/);
    const expenseRow = rowOf('Mercado do bairro');
    await pickOption(within(expenseRow).getAllByRole('combobox')[1], 'Alimentacao');
    const incomeRow = rowOf('Salario marco');
    await pickOption(within(incomeRow).getAllByRole('combobox')[1], 'Salario');
    // Installments on the expense row
    fireEvent.click(within(expenseRow).getAllByRole('switch')[0]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/ }));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm.mock.calls[0][0]).toEqual({
      transactions: [
        {
          date: '15/03/2026',
          description: 'Mercado do bairro',
          amount: 100,
          type: 'expense',
          payment_method: 'pix',
          entity_type: 'individual',
          bank_code: '260',
          category_id: 1,
          subcategory_id: 11,
          total_installments: 2,
          is_installment: true,
        },
        {
          date: '16/03/2026',
          description: 'Salario marco',
          amount: 3000,
          type: 'income',
          payment_method: 'pix',
          entity_type: 'individual',
          bank_code: '260',
          category_id: 2,
          subcategory_id: 21,
        },
      ],
    });
    expect(await screen.findByText('Confirmado ✓')).toBeInTheDocument();
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(queryKeys.transactions.all);
    expect(await screen.findByText('financial-page', undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('sends a typed new category name instead of an id', async () => {
    renderPage([makeSession()]);
    await screen.findByText('Revisar Extrato');
    await waitFor(() => expect(mockCategories).toHaveBeenCalled());
    await pickOption(screen.getAllByRole('combobox')[0], /Nubank/);
    const expenseRow = rowOf('Mercado do bairro');
    await pickOption(within(expenseRow).getAllByRole('combobox')[1], 'Outros...');
    fireEvent.change(within(expenseRow).getByPlaceholderText('Nova categoria'), { target: { value: 'Pets' } });
    const incomeRow = rowOf('Salario marco');
    await pickOption(within(incomeRow).getAllByRole('combobox')[1], 'Salario');

    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/ }));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    const [expense] = mockConfirm.mock.calls[0][0].transactions;
    expect(expense.category_name).toBe('Pets');
    expect(expense).not.toHaveProperty('category_id');
  });

  it('reports a failed confirmation without marking the session as confirmed', async () => {
    mockConfirm.mockRejectedValue(new Error('boom'));
    renderPage([makeSession()]);
    await screen.findByText('Revisar Extrato');
    await waitFor(() => expect(mockCategories).toHaveBeenCalled());
    await pickOption(screen.getAllByRole('combobox')[0], /Nubank/);
    await pickOption(within(rowOf('Mercado do bairro')).getAllByRole('combobox')[1], 'Alimentacao');
    await pickOption(within(rowOf('Salario marco')).getAllByRole('combobox')[1], 'Salario');

    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/ }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Falha ao confirmar sessão "extrato.csv".', variant: 'destructive' }),
      ),
    );
    expect(screen.queryByText('Confirmado ✓')).toBeNull();
  });
});

describe('BankExtract - adding a bank inline', () => {
  it('creates the bank, selects it for the session and refreshes the banks list', async () => {
    const inter = { id: 2, bank_code: '077', bank_name: 'Inter', created_at: '2026-01-01T00:00:00' };
    mockAddBank.mockImplementation(async () => {
      mockListBanks.mockResolvedValue([nubank, inter]);
      return inter;
    });
    const { client } = renderPage([makeSession()]);
    await screen.findByText('Revisar Extrato');
    await waitFor(() => expect(mockListBanks).toHaveBeenCalled());
    await pickOption(screen.getAllByRole('combobox')[0], /Adicionar novo banco/);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    fireEvent.change(screen.getByPlaceholderText('Ex: 260'), { target: { value: '077' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Nubank'), { target: { value: 'Inter' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar$/ }));

    await waitFor(() => expect(mockAddBank).toHaveBeenCalledWith({ bank_code: '077', bank_name: 'Inter' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('Ex: 260')).toBeNull());
    expect(client.getQueryData<Array<{ bank_code: string }>>(queryKeys.settings.banks())?.map((b) => b.bank_code)).toContain('077');
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(queryKeys.settings.all);
  });

  it('asks for both code and name before creating', async () => {
    renderPage([makeSession()]);
    await screen.findByText('Revisar Extrato');
    await pickOption(screen.getAllByRole('combobox')[0], /Adicionar novo banco/);

    fireEvent.click(screen.getByRole('button', { name: /Adicionar$/ }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Preencha código e nome do banco.', variant: 'destructive' }),
    );
    expect(mockAddBank).not.toHaveBeenCalled();
  });
});
