import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChipGroup } from './chip-group';

const OPTIONS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credit', label: 'Crédito' },
] as const;

describe('ChipGroup', () => {
  it('renders the options as a horizontally scrollable radiogroup', () => {
    render(<ChipGroup aria-label="Forma de pagamento" options={OPTIONS} value="pix" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Forma de pagamento' });
    expect(group.className).toContain('overflow-x-auto');
    expect(screen.getByRole('radio', { name: 'Pix' }).getAttribute('aria-checked')).toBe('true');
  });

  it('emits the clicked value', () => {
    const onChange = vi.fn();
    render(<ChipGroup aria-label="Forma de pagamento" options={OPTIONS} value="pix" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Crédito' }));
    expect(onChange).toHaveBeenCalledWith('credit');
  });

  it('supports a tab-like (non-radio) mode for navigation chips', () => {
    const onChange = vi.fn();
    render(<ChipGroup aria-label="Seções" variant="tabs" options={OPTIONS} value="pix" onChange={onChange} />);
    expect(screen.getByRole('tablist', { name: 'Seções' })).toBeTruthy();
    const selected = screen.getByRole('tab', { name: 'Pix' });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Dinheiro' }));
    expect(onChange).toHaveBeenCalledWith('cash');
  });
});
