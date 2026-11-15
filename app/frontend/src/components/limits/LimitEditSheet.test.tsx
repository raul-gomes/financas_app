import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LimitEditSheet } from './LimitEditSheet';
import type { Category } from './limitsModel';

const CATEGORY: Category = {
  id: 1,
  name: 'Moradia',
  entity_type: 'pf',
  limit: 3500,
  subcategories: [{ id: 10, name: 'Aluguel' }],
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof LimitEditSheet>> = {}) {
  const mocks = { onSave: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  render(
    <LimitEditSheet
      category={CATEGORY}
      isNew={false}
      nameLocked={false}
      saving={false}
      alertFor={() => null}
      {...mocks}
      {...overrides}
    />,
  );
  return mocks;
}

describe('LimitEditSheet', () => {
  it('edits the limit with a decimal keypad and full-width fields', () => {
    renderSheet();
    const limit = screen.getByLabelText('Limite mensal') as HTMLInputElement;
    expect(limit.getAttribute('inputmode')).toBe('decimal');
    const name = screen.getByLabelText('Nome da categoria') as HTMLInputElement;
    expect(name.className).toContain('w-full');
    expect(name.className).not.toMatch(/\bw-(\d+|\[)/);
  });

  it('saves the edited name, limit and subcategories', () => {
    const props = renderSheet();
    fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: 'Casa' } });
    const limit = screen.getByLabelText('Limite mensal');
    fireEvent.focus(limit);
    fireEvent.change(limit, { target: { value: '4000' } });
    fireEvent.blur(limit);
    fireEvent.change(screen.getByLabelText('Subcategoria 1'), { target: { value: 'Condomínio' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    const saved = props.onSave.mock.calls[0][0] as Category;
    expect(saved).toMatchObject({ id: 1, name: 'Casa', limit: 4000, isModified: true });
    expect(saved.subcategories[0]).toMatchObject({ id: 10, name: 'Condomínio' });
  });

  it('adds and removes subcategories', () => {
    const props = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar subcategoria' }));
    fireEvent.change(screen.getByLabelText('Subcategoria 2'), { target: { value: 'IPTU' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir subcategoria 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const saved = props.onSave.mock.calls[0][0] as Category;
    expect(saved.subcategories.map((s) => s.name)).toEqual(['IPTU']);
    expect(saved.subcategories[0].isNew).toBe(true);
  });

  it('does not allow saving without a name', () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText('Nome da categoria'), { target: { value: '  ' } });
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('locks the name of the special limits and hides subcategories and delete', () => {
    renderSheet({ nameLocked: true, category: { ...CATEGORY, name: 'Mensal PF' } });
    expect((screen.queryByLabelText('Nome da categoria') as HTMLInputElement | null)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Adicionar subcategoria' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir categoria' })).toBeNull();
  });

  it('shows the pre-save warning for the typed limit', () => {
    renderSheet({ alertFor: () => ({ severity: 'warning', percent: 85, spent: 2975 }) });
    expect(screen.getByTestId('limit-alert-moradia').textContent).toContain('85%');
  });

  it('asks for confirmation before deleting an existing category', () => {
    const props = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir categoria' }));
    expect(props.onDelete).not.toHaveBeenCalled();
    const confirm = screen.getByRole('dialog', { name: 'Excluir esta categoria?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Excluir' }));
    expect(props.onDelete).toHaveBeenCalledWith(CATEGORY);
  });

  it('does not offer delete for a new category', () => {
    renderSheet({ isNew: true, category: { ...CATEGORY, isNew: true } });
    expect(screen.queryByRole('button', { name: 'Excluir categoria' })).toBeNull();
  });
});
