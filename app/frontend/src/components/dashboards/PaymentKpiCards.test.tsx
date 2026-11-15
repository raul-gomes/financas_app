import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { PaymentKpiCards } from './PaymentKpiCards';
import type { Transaction } from '@/types/financial';

const mockListBanks = vi.fn();
const mockToast = vi.fn();

vi.mock('@/services/settingsService', () => ({
  SettingsService: { listBanks: () => mockListBanks() },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

function tx(id: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amount: 100,
    description: `T${id}`,
    category_id: 1,
    subcategory_id: 1,
    category_name: 'Lazer',
    subcategory_name: 'Streaming',
    payment_method: 'pix',
    installment_number: null,
    total_installments: null,
    is_installment: false,
    bank_code: '260',
    entity_type: 'individual',
    transaction_date: '2026-11-10T00:00:00',
    recurring_account_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListBanks.mockResolvedValue([{ id: 1, bank_code: '260', bank_name: 'Nubank' }]);
});

describe('PaymentKpiCards', () => {
  it('totals expenses per payment method', () => {
    renderWithQuery(
      <PaymentKpiCards
        transactions={[tx(1), tx(2, { amount: 50 }), tx(3, { payment_method: 'credit', amount: 300 })]}
        creditCardLimit={0}
      />,
    );
    expect(screen.getByRole('button', { name: /Pix/ }).textContent).toContain('R$');
    expect(screen.getByText('Cartão de Crédito')).toBeTruthy();
    expect(screen.getByText('Cartão de Débito')).toBeTruthy();
    expect(screen.getByText('Parcelas a Pagar')).toBeTruthy();
  });

  it('is a horizontal snap carousel on mobile and a grid from md', () => {
    renderWithQuery(<PaymentKpiCards transactions={[]} creditCardLimit={0} />);
    const row = document.getElementById('dashboard-ancora-metricas') as HTMLElement;
    expect(row.className).toContain('overflow-x-auto');
    expect(row.className).toContain('snap-x');
    expect(row.className).toContain('md:grid');
    expect(row.className).toContain('md:grid-cols-4');
  });

  it('opens the bank breakdown with the bank name when a card is tapped', async () => {
    renderWithQuery(<PaymentKpiCards transactions={[tx(1)]} creditCardLimit={0} />);
    await waitFor(() => expect(mockListBanks).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: /Pix/ }));
    expect(await screen.findByTitle('Nubank')).toBeTruthy();
  });

  it('warns the user when the banks fail to load (no silent catch; the query client logs the error)', async () => {
    mockListBanks.mockRejectedValue(new Error('boom'));
    renderWithQuery(<PaymentKpiCards transactions={[]} creditCardLimit={0} />);
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatchObject({ variant: 'destructive' });
  });
});
