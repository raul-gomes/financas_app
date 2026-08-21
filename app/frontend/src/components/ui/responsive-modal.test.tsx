import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResponsiveModal } from './responsive-modal';

describe('ResponsiveModal', () => {
  it('renderiza título, descrição, conteúdo e footer quando aberto', () => {
    render(
      <ResponsiveModal
        open
        onOpenChange={() => {}}
        title="Meu título"
        description="Minha descrição"
        footer={<button>Salvar</button>}
      >
        <p>Corpo do modal</p>
      </ResponsiveModal>,
    );

    expect(screen.getByText('Meu título')).toBeInTheDocument();
    expect(screen.getByText('Minha descrição')).toBeInTheDocument();
    expect(screen.getByText('Corpo do modal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('não renderiza nada quando fechado', () => {
    render(
      <ResponsiveModal open={false} onOpenChange={() => {}} title="Fechado">
        <p>conteúdo</p>
      </ResponsiveModal>,
    );

    expect(screen.queryByText('Fechado')).not.toBeInTheDocument();
  });

  it('propaga onOpenChange ao clicar no X', () => {
    const onOpenChange = vi.fn();
    render(
      <ResponsiveModal open onOpenChange={onOpenChange} title="X">
        <p>c</p>
      </ResponsiveModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
