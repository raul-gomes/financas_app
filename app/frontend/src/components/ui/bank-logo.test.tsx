import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { bankInitials, BankLogo, bankLogoUrl } from './bank-logo';

describe('bankLogoUrl', () => {
  it('normaliza código com padStart de 3 dígitos', () => {
    expect(bankLogoUrl('77')).toMatch(/\/077\.png$/);
    expect(bankLogoUrl('260')).toMatch(/\/260\.png$/);
  });
});

describe('bankInitials', () => {
  it('usa as duas primeiras palavras removendo S.A.', () => {
    expect(bankInitials('Banco do Brasil')).toBe('BD');
    expect(bankInitials('NU PAGAMENTOS S.A.')).toBe('NP');
    expect(bankInitials('Itaú Unibanco S.A.')).toBe('IU');
  });

  it('usa as duas primeiras letras para nome de palavra única', () => {
    expect(bankInitials('Nubank')).toBe('NU');
    expect(bankInitials('Inter')).toBe('IN');
  });
});

describe('BankLogo', () => {
  it('renderiza img com a URL do CDN quando há código', () => {
    render(<BankLogo code="260" alt="Nubank" />);
    const img = screen.getByRole('img', { name: 'Nubank' });
    expect(img).toHaveAttribute('src', bankLogoUrl('260'));
  });

  it('exibe fallback padrão com "?" quando não há código', () => {
    const { container } = render(<BankLogo code={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renderiza fallback customizado quando fornecido e sem código', () => {
    render(<BankLogo code={undefined} fallback={<span data-testid="custom">IT</span>} />);
    expect(screen.getByTestId('custom')).toBeInTheDocument();
  });

  it('troca para fallback automático quando o logo falha ao carregar', () => {
    const { container } = render(<BankLogo code="260" alt="Banco" />);
    fireEvent.error(screen.getByRole('img', { name: 'Banco' }));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('260')).toBeInTheDocument();
  });
});
