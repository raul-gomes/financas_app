import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';

describe('Logo', () => {
  it('shows the wordmark by default and hides the decorative mark', () => {
    const { container } = render(<Logo />);

    expect(screen.getByText('Placo')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('names the mark for assistive tech when the wordmark is hidden', () => {
    render(<Logo showWordmark={false} />);

    expect(screen.getByRole('img', { name: 'Placo' })).toBeInTheDocument();
    expect(screen.queryByText('Placo')).not.toBeInTheDocument();
  });

  it('applies the size classes and extra class names', () => {
    const { container } = render(<Logo size="lg" className="custom" />);

    expect(container.firstElementChild).toHaveClass('custom');
    expect(container.querySelector('svg')).toHaveClass('h-12', 'w-12');
  });

  it('colors the mark only through design tokens', () => {
    const { container } = render(<Logo />);

    expect(container.querySelector('svg')).toHaveClass('text-primary');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
