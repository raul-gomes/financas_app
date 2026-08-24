import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom retorna 0x0 em getBoundingClientRect, o que quebra virtualização
// (useVirtualizer) e gráficos responsivos (ResizeObserver). Fornece um
// viewport sintético estável para os testes.
if (typeof Element !== 'undefined' && !(Element.prototype as { __gbcrPatched?: boolean }).__gbcrPatched) {
  Element.prototype.getBoundingClientRect = function (): DOMRect {
    return {
      width: 1024,
      height: 800,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1024,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
  (Element.prototype as { __gbcrPatched?: boolean }).__gbcrPatched = true;
}

// jsdom retorna offsetHeight/offsetWidth = 0, que o @tanstack/react-virtual
// usa (getRect) para medir o scroll element e as linhas. Sem isso, a
// virtualização renderiza 0 itens nos testes. Valores fixos de viewport.
if (typeof HTMLElement !== 'undefined' && !(HTMLElement.prototype as { __offsetPatched?: boolean }).__offsetPatched) {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 800;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 1024;
    },
  });
  (HTMLElement.prototype as { __offsetPatched?: boolean }).__offsetPatched = true;
}

if (typeof globalThis !== 'undefined' && !(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
  class ResizeObserverStub implements ResizeObserver {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      // Dispara imediatamente com um viewport sintético (jsdom retorna 0x0),
      // permitindo que virtualização (useVirtualizer) e charts responsivos renderizem.
      const rect = target.getBoundingClientRect();
      const entry = {
        target,
        contentRect: {
          width: rect.width || 1024,
          height: rect.height || 800,
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
          x: rect.x,
          y: rect.y,
          toJSON: () => ({}),
        },
      } as ResizeObserverEntry;
      this.callback([entry], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

if (typeof window !== 'undefined') {
  if (!window.PointerEvent) {
    class PointerEventStub extends MouseEvent {
      pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
      }
    }
    (window as { PointerEvent?: unknown }).PointerEvent = PointerEventStub;
  }
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
}
