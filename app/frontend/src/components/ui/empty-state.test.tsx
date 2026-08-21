import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Target } from 'lucide-react';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renderiza título, descrição e ação opcional', () => {
    render(
      <EmptyState icon={Target} title="Nenhuma meta definida" description="Crie sua primeira meta">
        <button>Criar meta</button>
      </EmptyState>,
    );

    expect(screen.getByText('Nenhuma meta definida')).toBeInTheDocument();
    expect(screen.getByText('Crie sua primeira meta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar meta' })).toBeInTheDocument();
  });

  it('renderiza apenas o título quando nada mais é passado', () => {
    render(<EmptyState title="Vazio" />);
    expect(screen.getByText('Vazio')).toBeInTheDocument();
  });
});
