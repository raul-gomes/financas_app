import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { renderWithQuery } from '@/test/queryWrapper';
import { AppLayout } from './AppLayout';

let mockIsAdmin = false;
vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: mockIsAdmin }),
}));

vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

vi.mock('./LogoutButton', () => ({
  LogoutButton: () => null,
}));

vi.mock('@/components/dialogs/AddTransactionDialog', () => ({
  AddTransactionDialog: ({ onAddTransaction }: { onAddTransaction: (t: unknown) => void }) => (
    <button onClick={() => onAddTransaction({})}>confirmar-nova-transacao</button>
  ),
}));

const mounts = vi.fn();

beforeEach(() => {
  mounts.mockClear();
  mockIsAdmin = false;
});

function Page() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    mounts();
  }, []);
  return <button onClick={() => setCount((c) => c + 1)}>{`contador ${count}`}</button>;
}

function renderLayout() {
  return renderWithQuery(
    <MemoryRouter initialEntries={['/financial']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/financial" element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout - nova transação pelo botão +', () => {
  it('não remonta a página (mês e filtros ficam como estavam) e atualiza os dados pelo cache', async () => {
    const { client } = renderLayout();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    expect(mounts).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('contador 0'));
    expect(screen.getByText('contador 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Nova transação' }));
    fireEvent.click(await screen.findByText('confirmar-nova-transacao'));

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    // same page instance: its state survived and it did not mount again
    expect(screen.getByText('contador 1')).toBeTruthy();
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});

describe('AppLayout - navegação do desktop', () => {
  const desktopNav = () => within(screen.getAllByRole('navigation').find((n) => !n.getAttribute('aria-label')) as HTMLElement);

  it('admin vê os links de Recorrentes e Extrato bancário', () => {
    mockIsAdmin = true;
    renderLayout();
    expect(desktopNav().getByRole('link', { name: 'Recorrentes' }).getAttribute('href')).toBe('/recorrentes');
    expect(desktopNav().getByRole('link', { name: 'Extrato bancário' }).getAttribute('href')).toBe('/extrato-bancario');
  });

  it('usuário comum não vê os links de admin', () => {
    mockIsAdmin = false;
    renderLayout();
    expect(desktopNav().queryByRole('link', { name: 'Recorrentes' })).toBeNull();
    expect(desktopNav().queryByRole('link', { name: 'Extrato bancário' })).toBeNull();
  });
});
