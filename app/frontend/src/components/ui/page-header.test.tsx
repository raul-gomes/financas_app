import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renderiza título, descrição e ação', () => {
    render(
      <PageHeader
        icon={Wallet}
        title="Investimentos"
        description="Acompanhe sua carteira"
        action={<button>Novo</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Investimentos' })).toBeInTheDocument();
    expect(screen.getByText('Acompanhe sua carteira')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo' })).toBeInTheDocument();
  });

  it('renderiza sem ícone e sem ação', () => {
    render(<PageHeader title="Configurações" />);
    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
  });
});
