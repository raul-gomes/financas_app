import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { PaymentKpiCards } from './PaymentKpiCards';
import { EMPTY_STATEMENT_AGGREGATES } from '@/lib/statementAggregates';
import type { StatementAggregates } from '@/types/financial';

function renderCards(overrides: Partial<StatementAggregates> = {}, creditCardLimit = 0) {
  const data = { ...EMPTY_STATEMENT_AGGREGATES, ...overrides };
  return renderWithQuery(
    <PaymentKpiCards
      expensesByPaymentMethod={data.expenses_by_payment_method}
      expensesByBank={data.expenses_by_bank}
      installmentsDue={data.installments_due}
      creditCardLimit={creditCardLimit}
    />,
  );
}

describe('PaymentKpiCards', () => {
  it('shows the four cards', () => {
    renderCards({
      expenses_by_payment_method: [
        { payment_method: 'pix', total: 150 },
        { payment_method: 'credit', total: 300 },
      ],
    });
    expect(screen.getByRole('button', { name: /Pix/ }).textContent).toContain('R$');
    expect(screen.getByText('Cartão de Crédito')).toBeTruthy();
    expect(screen.getByText('Cartão de Débito')).toBeTruthy();
    expect(screen.getByText('Parcelas a Pagar')).toBeTruthy();
  });

  it('is a horizontal snap carousel on mobile and a grid from md', () => {
    renderCards();
    const row = document.getElementById('dashboard-ancora-metricas') as HTMLElement;
    expect(row.className).toContain('overflow-x-auto');
    expect(row.className).toContain('snap-x');
    expect(row.className).toContain('md:grid');
    expect(row.className).toContain('md:grid-cols-4');
  });

  it('opens the bank breakdown with the bank name sent by the server when a card is tapped', async () => {
    renderCards({
      expenses_by_payment_method: [{ payment_method: 'pix', total: 100 }],
      expenses_by_bank: [{ payment_method: 'pix', bank_code: '260', bank_name: 'Nubank', total: 100 }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Pix/ }));
    expect(await screen.findByTitle('Nubank')).toBeTruthy();
  });

  it('does not open a breakdown when the card has no bank rows', () => {
    renderCards({ expenses_by_payment_method: [{ payment_method: 'pix', total: 100 }] });
    fireEvent.click(screen.getByRole('button', { name: /Pix/ }));
    expect(screen.queryByTitle('Nubank')).toBeNull();
  });

  it('shows the installments footer from the installments due and lists the no-bank group', async () => {
    renderCards({
      installments_due: {
        remaining_amount: 90,
        remaining_installments: 3,
        transactions: 2,
        by_bank: [
          { bank_code: null, bank_name: 'Sem banco', remaining_amount: 90, remaining_installments: 3, transactions: 2 },
        ],
      },
    });
    const footer = screen.getByText((_, element) => element?.tagName === 'P' && /3 parcelas · 2 transações/.test(element.textContent ?? ''));
    expect(footer).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Parcelas a Pagar/ }));
    expect(await screen.findByTitle('Sem banco')).toBeTruthy();
  });

  it('flags the credit card as over the limit', () => {
    renderCards({ expenses_by_payment_method: [{ payment_method: 'credit', total: 1200 }] }, 1000);
    expect(screen.getByText('Estourando')).toBeTruthy();
  });
});
