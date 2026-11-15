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

  it('hideTitleOnMobile esconde o título abaixo de md (a barra superior já mostra) e mantém a ação', () => {
    const { container } = render(<PageHeader title="Configurações" hideTitleOnMobile action={<button>Novo</button>} />);
    const heading = screen.getByRole('heading', { name: 'Configurações' });
    expect(heading.closest('.max-md\\:hidden')).not.toBeNull();
    const action = screen.getByRole('button', { name: 'Novo' });
    expect(action.closest('.max-md\\:hidden')).toBeNull();
    expect((container.firstChild as HTMLElement).className).not.toContain('max-md:hidden');
  });

  it('hideTitleOnMobile sem ação esconde o cabeçalho inteiro no mobile', () => {
    const { container } = render(<PageHeader title="Configurações" hideTitleOnMobile />);
    expect((container.firstChild as HTMLElement).className).toContain('max-md:hidden');
  });
});
