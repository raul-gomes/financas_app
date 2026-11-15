import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from './segmented-control';

const OPTIONS = [
  { value: 'all', label: 'Ambos' },
  { value: 'pf', label: 'PF' },
  { value: 'pj', label: 'PJ' },
] as const;

describe('SegmentedControl', () => {
  it('exposes a radiogroup with the selected option checked', () => {
    render(<SegmentedControl aria-label="Tipo de conta" options={OPTIONS} value="pf" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Tipo de conta' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'PF' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Ambos' }).getAttribute('aria-checked')).toBe('false');
  });

  it('emits the clicked value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="Tipo de conta" options={OPTIONS} value="pf" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'PJ' }));
    expect(onChange).toHaveBeenCalledWith('pj');
  });

  it('moves the selection with the arrow keys', () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="Tipo de conta" options={OPTIONS} value="pf" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'PF' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('pj');
  });

  it('keeps only the checked option in the tab order', () => {
    render(<SegmentedControl aria-label="Tipo de conta" options={OPTIONS} value="pf" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'PF' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('radio', { name: 'PJ' }).getAttribute('tabindex')).toBe('-1');
  });
});
