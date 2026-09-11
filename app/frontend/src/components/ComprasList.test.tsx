import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ComprasList } from './ComprasList';

const mockListByMonth = vi.fn();

const mockToast = vi.fn();

vi.mock('@/services/shoppingService', () => ({
  ShoppingService: {
    listByMonth: (...args: unknown[]) => mockListByMonth(...args),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    migrar: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListByMonth.mockResolvedValue([]);
});

describe('ComprasList', () => {
  it('refaz o fetch com o novo tipo de entidade ao mudar de pf para pj', async () => {
    const { rerender } = render(<ComprasList sidebarOpen entityType="pf" />);

    await waitFor(() => {
      expect(mockListByMonth).toHaveBeenLastCalledWith(expect.any(String), 'individual');
    });

    rerender(<ComprasList sidebarOpen entityType="pj" />);

    await waitFor(() => {
      expect(mockListByMonth).toHaveBeenLastCalledWith(expect.any(String), 'business');
    });
  });
});