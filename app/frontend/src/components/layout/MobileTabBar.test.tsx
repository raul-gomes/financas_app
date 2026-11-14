import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { MobileTabBar } from './MobileTabBar';

const renderAt = (path: string, onAdd = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileTabBar onAddTransaction={onAdd} />
    </MemoryRouter>,
  );

describe('MobileTabBar', () => {
  it('renders the four labelled tabs with their routes', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Financeiro' })).toHaveAttribute('href', '/financial');
    expect(screen.getByRole('link', { name: 'Limites' })).toHaveAttribute('href', '/limits');
    expect(screen.getByRole('link', { name: 'Mais' })).toHaveAttribute('href', '/mais');
  });

  it('marks only the current tab with aria-current', () => {
    renderAt('/financial');

    expect(screen.getByRole('link', { name: 'Financeiro' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Limites' })).not.toHaveAttribute('aria-current');
  });

  it('keeps "Mais" active on a page of its menu', () => {
    renderAt('/recorrentes');

    expect(screen.getByRole('link', { name: 'Mais' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens the add-transaction flow from the central button', () => {
    const onAdd = vi.fn();
    renderAt('/', onAdd);

    fireEvent.click(screen.getByRole('button', { name: 'Nova transação' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('is hidden from md up and keeps touch targets of at least 44px', () => {
    renderAt('/');

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toHaveClass('md:hidden');
    expect(screen.getByRole('link', { name: 'Início' })).toHaveClass('min-h-[48px]');
    expect(screen.getByRole('button', { name: 'Nova transação' })).toHaveClass('h-14', 'w-14');
  });
});
