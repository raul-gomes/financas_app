import { describe, expect, it } from 'vitest';
import { TABS_AFTER_ADD, TABS_BEFORE_ADD, getRouteTitle, isTabActive } from './navigation';

const [home, financial] = TABS_BEFORE_ADD;
const [limits, more] = TABS_AFTER_ADD;

describe('getRouteTitle', () => {
  it('returns null on the home route so the logo is shown', () => {
    expect(getRouteTitle('/')).toBeNull();
  });

  it('returns the pt-BR title of known routes', () => {
    expect(getRouteTitle('/financial')).toBe('Financeiro');
    expect(getRouteTitle('/limits')).toBe('Limites');
    expect(getRouteTitle('/mais')).toBe('Mais');
    expect(getRouteTitle('/extrato-bancario')).toBe('Extrato bancário');
  });

  it('returns null for unknown routes', () => {
    expect(getRouteTitle('/nao-existe')).toBeNull();
  });
});

describe('isTabActive', () => {
  it('matches home only on the exact path', () => {
    expect(isTabActive(home, '/')).toBe(true);
    expect(isTabActive(home, '/financial')).toBe(false);
  });

  it('matches a tab on its path and sub-paths', () => {
    expect(isTabActive(financial, '/financial')).toBe(true);
    expect(isTabActive(financial, '/financial/x')).toBe(true);
    expect(isTabActive(limits, '/financial')).toBe(false);
  });

  it('keeps "Mais" active on the pages inside its menu', () => {
    for (const path of ['/mais', '/recorrentes', '/extrato-bancario', '/investments', '/configuracoes']) {
      expect(isTabActive(more, path)).toBe(true);
    }
    expect(isTabActive(more, '/limits')).toBe(false);
  });
});
