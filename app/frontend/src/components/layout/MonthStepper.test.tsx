import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthStepper } from './MonthStepper';

describe('MonthStepper', () => {
  it('shows the short pt-BR month and year', () => {
    render(<MonthStepper year={2026} month={11} onChange={vi.fn()} />);
    expect(screen.getByText('nov 2026')).toBeTruthy();
  });

  it('steps to the previous and next month', () => {
    const onChange = vi.fn();
    render(<MonthStepper year={2026} month={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(onChange).toHaveBeenLastCalledWith({ year: 2025, month: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(onChange).toHaveBeenLastCalledWith({ year: 2026, month: 2 });
  });
});
