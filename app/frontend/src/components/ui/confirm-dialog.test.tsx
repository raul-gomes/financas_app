import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './confirm-dialog';

const base = {
  open: true,
  onOpenChange: vi.fn(),
  title: 'Excluir conta?',
  description: 'Esta ação não pode ser desfeita.',
  onConfirm: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renderiza título e descrição quando aberto', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByText('Excluir conta?')).toBeInTheDocument();
    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();
  });

  it('cancelar apenas fecha o modal', () => {
    render(<ConfirmDialog {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(base.onConfirm).not.toHaveBeenCalled();
    expect(base.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('confirmar executa ação e fecha o modal', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} onConfirm={onConfirm} confirmLabel="Excluir" />);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('não renderiza quando fechado', () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByText('Excluir conta?')).not.toBeInTheDocument();
  });
});
