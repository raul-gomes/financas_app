import { describe, it, expect, vi } from 'vitest';
import { reportLoadError } from './reportLoadError';

describe('reportLoadError', () => {
  it('logs the error and shows a destructive pt-BR toast naming what failed to load', () => {
    const toast = vi.fn();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('boom');

    reportLoadError(toast, 'os bancos', failure);

    expect(logged).toHaveBeenCalledWith('Falha ao carregar os bancos:', failure);
    expect(toast).toHaveBeenCalledWith({
      title: 'Erro',
      description: 'Falha ao carregar os bancos.',
      variant: 'destructive',
    });
    logged.mockRestore();
  });
});
