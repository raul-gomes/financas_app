import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('aplica classes do variant warning (tag Acabando)', () => {
    render(<Badge variant="warning">Acabando</Badge>);
    const badge = screen.getByText('Acabando');
    expect(badge.className).toContain('bg-amber-500/15');
    expect(badge.className).toContain('text-amber-600');
  });

  it('variant default usa bg-primary', () => {
    render(<Badge>Padrão</Badge>);
    expect(screen.getByText('Padrão').className).toContain('bg-primary');
  });
});
