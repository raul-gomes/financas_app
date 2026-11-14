import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecurringBillsTable } from './RecurringBillsTable';
import type { ContaRecorrente } from '@/types/recurringAccount';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));

const conta = (over: Partial<ContaRecorrente>): ContaRecorrente => ({
  id: 1,
  description: 'Netflix',
  amount: 55.9,
  due_day: 10,
  entity_type: 'individual',
  payment_method: 'credito',
  bank_code: '260',
  current_installment: 5,
  is_ending_soon: false,
  category_id: 1,
  subcategory_id: 1,
  category_name: 'Lazer',
  subcategory_name: 'Streaming',
  start_date: '2026-01-01',
  end_date: null,
  total_installments: 12,
  remaining_installments: 8,
  active: true,
  ...over,
});

const setup = (over: Partial<Parameters<typeof RecurringBillsTable>[0]> = {}) => ({
  contas: [conta({ id: 1 }), conta({ id: 2, description: 'Academia', active: false })],
  onToggleActive: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRenew: vi.fn(),
  renewingId: null,
  ...over,
});

describe('RecurringBillsTable (mobile cards)', () => {
  it('renders one card per bill instead of the table', () => {
    render(<RecurringBillsTable {...setup()} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText('Academia')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s55,90/)).toHaveLength(2);
  });

  it('shows the bank only when showBank is set', () => {
    const { rerender } = render(<RecurringBillsTable {...setup()} />);
    expect(screen.queryByText('260')).not.toBeInTheDocument();

    rerender(<RecurringBillsTable {...setup({ showBank: true })} />);
    expect(screen.getAllByText('260').length).toBeGreaterThan(0);
  });

  it('keeps the same actions with 44px touch targets', () => {
    const props = setup();
    render(<RecurringBillsTable {...props} />);

    const edit = screen.getByRole('button', { name: 'Editar Netflix' });
    expect(edit).toHaveClass('h-11', 'w-11');
    fireEvent.click(edit);
    expect(props.onEdit).toHaveBeenCalledWith(props.contas[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Netflix' }));
    expect(props.onDelete).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /Inativa/ }));
    expect(props.onToggleActive).toHaveBeenCalledWith(props.contas[1]);
  });

  it('disables renewal while installments remain', () => {
    render(<RecurringBillsTable {...setup()} />);

    expect(screen.getByRole('button', { name: 'Renovar Netflix' })).toBeDisabled();
  });
});
