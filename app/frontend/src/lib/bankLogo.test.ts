import { describe, expect, it } from 'vitest';
import { bankInitials, bankLogoUrl } from './bankLogo';

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
