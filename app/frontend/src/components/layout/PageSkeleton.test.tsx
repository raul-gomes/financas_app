import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSkeleton } from './PageSkeleton';

describe('PageSkeleton', () => {
  it('announces the loading state to assistive technology in pt-BR', () => {
    render(<PageSkeleton />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Carregando página…');
  });
});
