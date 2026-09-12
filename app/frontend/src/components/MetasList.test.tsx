import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MetasList } from './MetasList';

const mockProgresso = vi.fn();

vi.mock('@/services/goalsService', () => ({
  MetasService: {
    progresso: (...args: unknown[]) => mockProgresso(...args),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    concluir: vi.fn(),
    reativar: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockProgresso.mockResolvedValue([]);
});

describe('MetasList', () => {
  it('refaz o fetch quando refreshKey muda', async () => {
    const { rerender } = render(<MetasList sidebarOpen entityType="pf" refreshKey={0} />);

    await waitFor(() => {
      expect(mockProgresso.mock.calls.length).toBeGreaterThan(0);
    });
    const callsBefore = mockProgresso.mock.calls.length;

    rerender(<MetasList sidebarOpen entityType="pf" refreshKey={1} />);

    await waitFor(() => {
      expect(mockProgresso.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});