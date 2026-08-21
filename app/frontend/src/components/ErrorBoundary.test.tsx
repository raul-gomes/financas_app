import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const silenceConsole = () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return spy;
};

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('explosao controlada');
  return <p>conteúdo recuperado</p>;
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza os filhos normalmente quando não há erro', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('conteúdo recuperado')).toBeInTheDocument();
  });

  it('captura o erro e exibe o fallback sem derrubar a árvore externa', () => {
    const spy = silenceConsole();
    render(
      <div>
        <p>sidebar intacta</p>
        <ErrorBoundary>
          <Bomb shouldThrow />
        </ErrorBoundary>
      </div>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/algo deu errado/i)).toBeInTheDocument();
    expect(screen.getByText('explosao controlada')).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it('permite recuperar clicando em "Tentar novamente"', () => {
    silenceConsole();
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(screen.getByText('conteúdo recuperado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('aceita título customizado no fallback', () => {
    silenceConsole();
    render(
      <ErrorBoundary fallbackTitle="Falha no dashboard">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Falha no dashboard')).toBeInTheDocument();
  });
});
