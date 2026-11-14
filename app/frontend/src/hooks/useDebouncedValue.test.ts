import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

const DELAY_MS = 300;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('starts with the initial value', () => {
    const { result } = renderHook(() => useDebouncedValue('a', DELAY_MS));

    expect(result.current).toBe('a');
  });

  it('only publishes the latest value once the delay passes without changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, DELAY_MS), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(DELAY_MS - 1));
    rerender({ value: 'abc' });
    act(() => vi.advanceTimersByTime(DELAY_MS - 1));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('abc');
  });
});
