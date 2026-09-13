import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartAnchors } from './ChartAnchors';

const scrollIntoViewMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
});

describe('ChartAnchors', () => {
  const items = [
    { id: 'metricas', label: 'Métricas' },
    { id: 'grafico-rendimento', label: 'Rendimento' },
    { id: 'graficos-categorias', label: 'Categorias' },
  ];

  it('renderiza uma âncora para cada seção', () => {
    render(<ChartAnchors items={items} />);
    expect(screen.getByRole('button', { name: 'Métricas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rendimento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Categorias' })).toBeInTheDocument();
  });

  it('rola suavemente até a seção alvo ao clicar', () => {
    const target = document.createElement('div');
    target.id = 'grafico-rendimento';
    document.body.appendChild(target);
    try {
      render(<ChartAnchors items={items} />);
      fireEvent.click(screen.getByRole('button', { name: 'Rendimento' }));
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    } finally {
      target.remove();
    }
  });

  it('não quebra quando a seção alvo não existe', () => {
    render(<ChartAnchors items={[{ id: 'inexistente', label: 'Fantasma' }]} />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Fantasma' }))).not.toThrow();
  });
});