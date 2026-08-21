import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecurringBillsTable } from './RecurringBillsTable';
import type { ContaRecorrente } from '@/types/recurringAccount';

const base = (over: Partial<ContaRecorrente>): ContaRecorrente => ({
  id: 1,
  description: 'Netflix',
  amount: 55.9,
  due_day: 10,
  entity_type: 'individual',
  payment_method: 'credito',
  bank_code: null,
  group_id: null,
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

const contas: ContaRecorrente[] = [
  base({ id: 1 }),
  base({ id: 2, description: 'Academia', active: false }),
  base({ id: 3, description: 'Notebook', total_installments: 12, remaining_installments: 1, bank_code: '260' }),
];

describe('RecurringBillsTable', () => {
  const setup = (over: Partial<Parameters<typeof RecurringBillsTable>[0]> = {}) => ({
    contas,
    onToggleActive: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRenew: vi.fn(),
    renewingId: null,
    ...over,
  });

  it('renderiza colunas básicas sem a coluna Banco por padrão', () => {
    render(<RecurringBillsTable {...setup()} />);
    expect(screen.getByText('Descricao')).toBeInTheDocument();
    expect(screen.queryByText('Banco')).not.toBeInTheDocument();
    ['Netflix', 'Academia', 'Notebook'].forEach((d) => expect(screen.getByText(d)).toBeInTheDocument());
  });

  it('exibe a coluna Banco quando showBank', () => {
    render(<RecurringBillsTable {...setup({ showBank: true })} />);
    expect(screen.getByText('Banco')).toBeInTheDocument();
    expect(screen.getByText('260')).toBeInTheDocument();
  });

  it('mostra badge Acabando apenas em parcelas finais de contas ativas', () => {
    render(<RecurringBillsTable {...setup()} />);
    expect(screen.getAllByText('Acabando')).toHaveLength(1);
  });

  it('dispara callbacks de edição, exclusão e toggle', () => {
    const props = setup();
    render(<RecurringBillsTable {...props} />);

    fireEvent.click(screen.getAllByTitle(/editar/i)[0]);
    expect(props.onEdit).toHaveBeenCalledWith(contas[0]);

    fireEvent.click(screen.getAllByTitle(/excluir/i)[0]);
    expect(props.onDelete).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getAllByText('Ativa')[0]);
    expect(props.onToggleActive).toHaveBeenCalledWith(contas[0]);
  });

  it('renova quando habilitada', () => {
    const props = setup();
    render(<RecurringBillsTable {...props} />);

    const renewButtons = screen.getAllByTitle('Renovar por mais 12 meses');
    expect(renewButtons.length).toBeGreaterThan(0);
    fireEvent.click(renewButtons[0]);
    expect(props.onRenew).toHaveBeenCalled();
  });
});
