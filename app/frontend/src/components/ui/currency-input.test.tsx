import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CurrencyInput } from './currency-input';

describe('CurrencyInput', () => {
  it('exibe valor formatado em pt-BR com prefixo R$ quando desfocado', () => {
    render(<CurrencyInput value="1234.5" onChange={() => {}} />);
    expect(screen.getByText('R$')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('1.234,50');
  });

  it('aceita vírgula decimal e emite valor canônico ao sair do campo', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CurrencyInput value="" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1234,56' } });
    expect(onChange).toHaveBeenCalledWith('1234.56');

    fireEvent.blur(input);
    rerender(<CurrencyInput value="1234.56" onChange={onChange} />);
    expect(screen.getByRole('textbox')).toHaveValue('1.234,56');
  });

  it('normaliza separadores mistos (1.234,56 → 1234.56)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CurrencyInput value="" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1.234,56' } });
    fireEvent.blur(input);
    rerender(<CurrencyInput value="1234.56" onChange={onChange} />);

    expect(onChange).toHaveBeenCalledWith('1234.56');
    expect(screen.getByRole('textbox')).toHaveValue('1.234,56');
  });

  it('bloqueia caracteres não numéricos', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc12x3' } });

    expect(input).toHaveValue('123');
    expect(onChange).toHaveBeenCalledWith('123');
  });

  it('limpar o campo emite string vazia e exibe vazio', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CurrencyInput value="99.9" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');

    rerender(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.blur(input);
    expect(input).toHaveValue('');
  });
});
