import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('renderiza label, valor e hint', () => {
    render(<StatCard label="Total mensal" value="R$1.234,56" hint="8 contas ativas" />);
    expect(screen.getByText('Total mensal')).toBeInTheDocument();
    expect(screen.getByText('R$1.234,56')).toBeInTheDocument();
    expect(screen.getByText('8 contas ativas')).toBeInTheDocument();
  });

  it('aplica o tone success no ícone e no valor', () => {
    const { container } = render(
      <StatCard icon={Wallet} tone="success" label="Receita" value="R$100" />,
    );
    expect(container.querySelector('.text-success')).not.toBeNull();
    expect(container.innerHTML).toContain('bg-success/10');
  });

  it('tone destructive aplica classes correspondentes', () => {
    const { container } = render(<StatCard icon={Wallet} tone="destructive" label="Gasto" value="R$50" />);
    expect(container.querySelector('.text-destructive')).not.toBeNull();
  });
});
