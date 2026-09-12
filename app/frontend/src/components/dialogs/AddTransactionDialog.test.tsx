import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AddTransactionDialog } from './AddTransactionDialog';

const mockGetCategorySubcategories = vi.fn();
const mockListBanks = vi.fn();
const mockCheckCategoryRisk = vi.fn();
const mockCheckDuplicates = vi.fn();
const mockAddTransaction = vi.fn();

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
  },
  UserBank: {},
}));

vi.mock('@/services/notificationService', () => ({
  NotificationService: {
    checkCategoryRisk: (...args: unknown[]) => mockCheckCategoryRisk(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
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
  // Abre o Select de categoria via gatilho (placeholder)
  fireEvent.click(screen.getByText('Select a category'));
  const option = await screen.findByRole('option', { name: 'Alimentacao' });
  fireEvent.click(option);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCategorySubcategories.mockResolvedValue(categoryOptions);
  mockListBanks.mockResolvedValue([]);
  mockCheckDuplicates.mockResolvedValue({ results: [{ has_duplicate: false }] });
  mockAddTransaction.mockResolvedValue(undefined);
});

describe('AddTransactionDialog', () => {
  it('mostra aviso não-bloqueante quando a categoria tem limite estourado', async () => {
    mockCheckCategoryRisk.mockResolvedValue({
      category_id: 10,
      category_name: 'Alimentacao',
      limit: 1000,
      spent: 1100,
      percent_used: 110,
      is_over_limit: true,
    });

    render(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Select a category')).toBeTruthy();
    });

    await selectCategory();

    await waitFor(() => {
      expect(mockCheckCategoryRisk).toHaveBeenCalledWith(10);
    });
    await waitFor(() => {
      expect(screen.getByText(/limite de "Alimentacao" está estourado/)).toBeTruthy();
    });
    expect(screen.getByText(/Segure a mão/)).toBeTruthy();
  });

  it('não mostra aviso quando a categoria está ok', async () => {
    mockCheckCategoryRisk.mockResolvedValue({
      category_id: 10,
      category_name: 'Alimentacao',
      limit: 1000,
      spent: 200,
      percent_used: 20,
      is_over_limit: false,
    });

    render(<AddTransactionDialog isOpen onClose={vi.fn()} onAddTransaction={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Select a category')).toBeTruthy();
    });

    await selectCategory();

    await waitFor(() => {
      expect(mockCheckCategoryRisk).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText(/está estourado/)).toBeNull();
      expect(screen.queryByText(/Segure a mão/)).toBeNull();
    });
  });
});