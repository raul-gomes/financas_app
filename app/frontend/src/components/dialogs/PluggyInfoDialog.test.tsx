import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PluggyInfoDialog } from './PluggyInfoDialog';

describe('PluggyInfoDialog (smoke)', () => {
  it('renderiza o gatilho e abre o modal sem quebrar a árvore React', async () => {
    render(<PluggyInfoDialog />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(await screen.findByText(/Meu Pluggy — Open Finance/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por que usar o Pluggy?' })).toBeInTheDocument();
  });
});
