import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserver {
  root = null
  rootMargin = '0px'
  thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserver,
  writable: true,
})

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: IntersectionObserver,
  writable: true,
})
