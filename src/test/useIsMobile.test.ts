import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useIsMobile from '../hooks/useIsMobile';

describe('useIsMobile', () => {
  let listeners: Array<(e: MediaQueryListEvent) => void> = [];
  let matchesValue = false;

  beforeEach(() => {
    listeners = [];
    matchesValue = false;
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matchesValue,
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => { listeners.push(cb); },
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners = listeners.filter(l => l !== cb);
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when matchMedia matches (mobile width)', () => {
    matchesValue = true;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false when matchMedia does not match (desktop width)', () => {
    matchesValue = false;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('responds to media query changes', () => {
    matchesValue = false;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });
    expect(result.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    matchesValue = false;
    const { unmount } = renderHook(() => useIsMobile());
    expect(listeners.length).toBe(1);
    unmount();
    expect(listeners.length).toBe(0);
  });
});
