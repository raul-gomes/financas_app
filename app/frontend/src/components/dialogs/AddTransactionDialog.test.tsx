import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { AddTransactionDialog } from './AddTransactionDialog';

const mockGetCategorySubcategories = vi.fn();
const mockListBanks = vi.fn();
const mockCheckCategoryRisk = vi.fn();
const mockCheckDuplicates = vi.fn();
const mockAddTransaction = vi.fn();
const mockAddBank = vi.fn();
const mockSearchBrasilApi = vi.fn();
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
    listBanks: (...args: unknown[]) => mockListBanks(...args),
    addBank: (...args: unknown[]) => mockAddBank(...args),
    searchBrasilApi: (...args: unknown[]) => mockSearchBrasilApi(...args),
  },
  UserBank: {},
}));

vi.mock('@/services/notificationService', () => ({
  NotificationService: {
    checkCategoryRisk: (...args: unknown[]) => mockCheckCategoryRisk(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const categoryOptions = {
  options: [
    {
      id: 10,
      name: 'Alimentacao',
      subcategories: [{ id: 20, name: 'Supermercado' }],
    },
  ],
};

async function selectCategory() {
  fireEvent.click(screen.getByText('Selecione uma categoria'));
  const option = await screen.findByRole('option', { name: 'Alimentacao' });
  fireEvent.click(option);
}

async function selectSubcategory() {
  fireEvent.click(screen.getByText('Selecione uma subcategoria'));
  const option = await screen.findByRole('option', { name: 'Supermercado' });
  fireEvent.click(option);
}

async function fillAmount(value: string) {
  const amount = screen.getByLabelText('Valor *');
  fireEvent.focus(amount);
  fireEvent.change(amount, { target: { value } });
  fireEvent.blur(amount);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCategorySubcategories.mockResolvedValue(categoryOptions);
  mockListBanks.mockResolvedValue([]);
  mockCheckDuplicates.mockResolvedValue({ results: [{ has_duplicate: false }] });
  mockAddTransaction.mockResolvedValue(undefined);
});

async function renderAndFillBaseForm() {
  renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByText('Selecione uma categoria')).toBeTruthy();
  });
  await selectCategory();
  await selectSubcategory();
  await fillAmount('1000');
  fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Mercado' } });
  return;
}

describe('AddTransactionDialog', () => {
  it('mostra aviso não-bloqueante quando a categoria tem limite estourado', async () => {
    mockCheckCategoryRisk.mockResolvedValue({
      category_id: 10,
      category_name: 'Alimentacao',
      limit: 1000,
      spent: 1100,
      amount: 0,
      projected_spent: 1100,
      percent_used: 110,
      projected_percent_used: 110,
      is_over_limit: true,
      severity: 'destructive',
      thresholds_hit: [80, 90, 100],
    });

    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Selecione uma categoria')).toBeTruthy();
    });

    await selectCategory();

    await waitFor(() => {
      expect(mockCheckCategoryRisk).toHaveBeenCalledWith(10, 0);
    });
    await waitFor(() => {
      expect(screen.getByText(/estourará o limite de "Alimentacao"/)).toBeTruthy();
    });
    expect(screen.getByTestId('category-risk-banner').dataset.severity).toBe('destructive');
    expect(screen.getByText(/Segure a mão/)).toBeTruthy();
  });

  it('recalcula o risco com o valor digitado e mostra a % projetada com cor', async () => {
    mockCheckCategoryRisk.mockImplementation((id: number, amount: number) => {
      const spent = 400;
      const projected = spent + (amount || 0);
      const percent = Math.round((projected / 1000) * 100);
      return Promise.resolve({
        category_id: id,
        category_name: 'Alimentacao',
        limit: 1000,
        spent,
        amount: amount || 0,
        projected_spent: projected,
        percent_used: 40,
        projected_percent_used: percent,
        is_over_limit: percent >= 100,
        severity: percent >= 100 ? 'destructive' : percent >= 90 ? 'critical' : percent >= 80 ? 'warning' : null,
        thresholds_hit: [80, 90, 100].filter(t => percent >= t),
      });
    });

    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Selecione uma categoria')).toBeTruthy();
    });

    await selectCategory();
    await waitFor(() => {
      expect(mockCheckCategoryRisk).toHaveBeenCalledTimes(1);
    });

    await fillAmount('500');

    await waitFor(() => {
      expect(mockCheckCategoryRisk).toHaveBeenCalledWith(10, 500);
    });
    const banner = await screen.findByTestId('category-risk-banner');
    expect(banner.dataset.severity).toBe('critical');
    expect(screen.getByText(/90% do limite/)).toBeTruthy();
    expect(screen.getByText(/Gasto atual R\$/)).toBeTruthy();
  });

  it('não mostra aviso quando a categoria está ok', async () => {
    mockCheckCategoryRisk.mockResolvedValue({
      category_id: 10,
      category_name: 'Alimentacao',
      limit: 1000,
      spent: 200,
      amount: 0,
      projected_spent: 200,
      percent_used: 20,
      projected_percent_used: 20,
      is_over_limit: false,
      severity: null,
      thresholds_hit: [],
    });

    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Selecione uma categoria')).toBeTruthy();
    });

    await selectCategory();

    await waitFor(() => {
      expect(mockCheckCategoryRisk).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText(/está estourado/)).toBeNull();
      expect(screen.queryByText(/Segure a mão/)).toBeNull();
      expect(screen.queryByTestId('category-risk-banner')).toBeNull();
    });
  });

  it('renderiza o formulário todo em português', async () => {
    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Nova Transação')).toBeTruthy();
    });

    expect(screen.getByText('Tipo')).toBeTruthy();
    expect(screen.getByText('Despesa')).toBeTruthy();
    expect(screen.getByText('Receita')).toBeTruthy();
    expect(screen.getByText('Investimento')).toBeTruthy();
    expect(screen.getByLabelText('Valor *')).toBeTruthy();
    expect(screen.getByLabelText('Data')).toBeTruthy();
    expect(screen.getByLabelText('Descrição *')).toBeTruthy();
    expect(screen.getByText('Categoria *')).toBeTruthy();
    expect(screen.getByText('Banco')).toBeTruthy();
    expect(screen.getByText('Forma de pagamento')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
    expect(screen.getByText('Adicionar')).toBeTruthy();
  });

  it('mascara a data no formato dd/mm/yyyy', async () => {
    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    const dateInput = screen.getByLabelText('Data') as HTMLInputElement;

    // The dialog defaults to the user's LOCAL date (toISOString would use UTC and flake near midnight).
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    expect(dateInput.value).toBe(`${d}/${m}/${y}`);

    fireEvent.change(dateInput, { target: { value: '15092026' } });
    expect(dateInput.value).toBe('15/09/2026');

    fireEvent.change(dateInput, { target: { value: '05122025' } });
    expect(dateInput.value).toBe('05/12/2025');
  });

  it('envia a data no padrão ISO (yyyy-mm-dd) ao salvar', async () => {
    await renderAndFillBaseForm();

    const dateInput = screen.getByLabelText('Data');
    fireEvent.change(dateInput, { target: { value: '15092026' } });

    fireEvent.click(screen.getByText('Adicionar'));

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalled();
    });
    const payload = mockAddTransaction.mock.calls[0][0];
    expect(payload.transaction_date).toBe('2026-09-15');
  });

  it('adiciona banco novo via busca (como em Configurações), chamando a API', async () => {
    mockListBanks.mockResolvedValue([{ id: 1, bank_code: '341', bank_name: 'Itaú', created_at: '' }]);
    mockSearchBrasilApi.mockResolvedValue([
      { code: '260', name: 'NUBANK', fullName: 'NU PAGAMENTOS S.A. - NUBANK', ispb: '00000000000000' },
    ]);
    mockAddBank.mockResolvedValue({ id: 3, bank_code: '260', bank_name: 'NU PAGAMENTOS S.A. - NUBANK', created_at: '' });

    renderWithQuery(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Selecione um banco')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Selecione um banco'));
    const addBank = await screen.findByRole('option', { name: /Adicionar novo banco/ });
    fireEvent.click(addBank);

    const box = screen.getByTestId('new-bank-box');
    expect(box.className).toContain('sm:col-span-2');

    const searchInput = screen.getByPlaceholderText(/Digite o nome do banco/);
    fireEvent.change(searchInput, { target: { value: 'nu' } });

    const result = await screen.findByRole('button', { name: /NU PAGAMENTOS/ });
    fireEvent.click(result);

    await waitFor(() => {
      expect(mockSearchBrasilApi).toHaveBeenCalledWith('nu');
      expect(mockAddBank).toHaveBeenCalledWith({
        bank_code: '260',
        bank_name: 'NU PAGAMENTOS S.A. - NUBANK',
      });
    });
  });

  it('avisa e loga quando a checagem de duplicidade falha, mas ainda salva', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCheckDuplicates.mockRejectedValue(new Error('network'));
    await renderAndFillBaseForm();

    fireEvent.click(screen.getByText('Adicionar'));

    await waitFor(() => expect(mockAddTransaction).toHaveBeenCalled());
    expect(consoleError).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Aviso', description: expect.stringContaining('duplicidade') }),
    );
    consoleError.mockRestore();
  });
});