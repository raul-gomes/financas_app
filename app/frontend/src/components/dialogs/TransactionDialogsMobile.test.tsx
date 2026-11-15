import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { AddTransactionDialog } from './AddTransactionDialog';
import { EditTransactionDialog } from './EditTransactionDialog';
import type { Transaction } from '@/types/financial';

const mockGetCategorySubcategories = vi.fn();
const mockListBanks = vi.fn();
const mockCheckDuplicates = vi.fn();
const mockAddTransaction = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/financialService', () => ({
  FinancialService: {
    getCategorySubcategories: (...args: unknown[]) => mockGetCategorySubcategories(...args),
    checkDuplicates: (...args: unknown[]) => mockCheckDuplicates(...args),
    addTransaction: (...args: unknown[]) => mockAddTransaction(...args),
  },
}));

vi.mock('@/services/settingsService', () => ({
  SettingsService: {
    listBanks: () => mockListBanks(),
    addBank: vi.fn(),
    searchBrasilApi: vi.fn(),
  },
  UserBank: {},
}));

vi.mock('@/services/notificationService', () => ({
  NotificationService: { checkCategoryRisk: vi.fn().mockResolvedValue(null) },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const OPTIONS = {
  options: [{ id: 10, name: 'Alimentacao', subcategories: [{ id: 20, name: 'Supermercado' }] }],
};

const originalWidth = window.innerWidth;

beforeEach(() => {
  vi.clearAllMocks();
  window.innerWidth = 390;
  mockGetCategorySubcategories.mockResolvedValue(OPTIONS);
  mockListBanks.mockResolvedValue([]);
  mockCheckDuplicates.mockResolvedValue({ results: [{ has_duplicate: false }] });
  mockAddTransaction.mockResolvedValue(undefined);
});

afterEach(() => {
  window.innerWidth = originalWidth;
});

async function pick(placeholder: string, option: string) {
  fireEvent.click(screen.getByText(placeholder));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('AddTransactionDialog no celular', () => {
  it('usa o tipo segmentado, valor grande com teclado decimal, chips e Salvar em largura total', async () => {
    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Tipo de transação' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Saída' }).getAttribute('aria-checked')).toBe('true');
    // no radios/switch row of the desktop layout
    expect(screen.queryByText('Despesa')).toBeNull();
    expect(screen.getByLabelText('Valor *').getAttribute('inputmode')).toBe('decimal');
    expect(screen.getByRole('radiogroup', { name: 'Forma de pagamento' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Tipo de conta' })).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Salvar' });
    expect(save.className).toContain('w-full');
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('salva com a forma de pagamento e o tipo de conta escolhidos nos chips', async () => {
    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Selecione uma categoria')).toBeTruthy());

    await pick('Selecione uma categoria', 'Alimentacao');
    await pick('Selecione uma subcategoria', 'Supermercado');
    const amount = screen.getByLabelText('Valor *');
    fireEvent.focus(amount);
    fireEvent.change(amount, { target: { value: '55,90' } });
    fireEvent.blur(amount);
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Mercado' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Crédito' }));
    fireEvent.click(screen.getByRole('radio', { name: 'PJ' }));

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockAddTransaction).toHaveBeenCalled());
    expect(mockAddTransaction.mock.calls[0][0]).toMatchObject({
      type: 'expense',
      amount: 55.9,
      payment_method: 'credit',
      entity_type: 'business',
    });
  });

  it('o tipo Entrada fixa a categoria automática', async () => {
    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Entrada' }));
    const category = (await screen.findByDisplayValue('Receita')) as HTMLInputElement;
    expect(category.disabled).toBe(true);
  });
});

describe('EditTransactionDialog', () => {
  const transaction: Transaction = {
    id: 7,
    type: 'expense',
    amount: 280,
    description: 'Conta de Luz',
    category_id: 10,
    subcategory_id: 20,
    category_name: 'Alimentacao',
    subcategory_name: 'Supermercado',
    payment_method: 'debit',
    installment_number: null,
    total_installments: null,
    is_installment: false,
    bank_code: null,
    entity_type: 'individual',
    transaction_date: '2026-11-14T00:00:00',
    recurring_account_id: null,
  };

  it('abre com os valores da transação e salva só o que mudou (celular)', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithQuery(<EditTransactionDialog isOpen onClose={onClose} transaction={transaction} onEditTransaction={onEdit} />);

    expect((screen.getByLabelText('Descrição *') as HTMLInputElement).value).toBe('Conta de Luz');
    expect((screen.getByLabelText('Data') as HTMLInputElement).value).toBe('14/11/2026');
    expect(screen.getByRole('radio', { name: 'Débito' }).getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(mockGetCategorySubcategories).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Conta de Luz Nov' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    expect(onEdit.mock.calls[0][0]).toMatchObject({
      id: 7,
      description: 'Conta de Luz Nov',
      amount: 280,
      payment_method: 'debit',
      transaction_date: '2026-11-14',
      is_installment: false,
      total_installments: null,
      bank_code: null,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('avisa quando as categorias não carregam', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetCategorySubcategories.mockRejectedValue(new Error('boom'));
    renderWithQuery(<EditTransactionDialog isOpen onClose={vi.fn()} transaction={transaction} onEditTransaction={vi.fn()} />);
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Falha ao carregar categorias.' })),
    );
  });

  it('mostra uma forma de pagamento personalizada como "Outro"', async () => {
    renderWithQuery(
      <EditTransactionDialog
        isOpen
        onClose={vi.fn()}
        transaction={{ ...transaction, payment_method: 'Vale-refeição' }}
        onEditTransaction={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Outro' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Nova forma de pagamento') as HTMLInputElement).value).toBe('Vale-refeição');
  });
});
