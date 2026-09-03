// Minimal React / jsx-runtime mocks + tree utilities for rendering a
// function component ONCE and inspecting the plain-object tree that
// results — enough to locate a specific element's event handler and invoke
// it directly. This is NOT a real renderer: `useState` setters are no-ops
// (fine for a single render pass — see `stateOverrides` below for reaching
// a render where a given `useState` call's value needs to differ from its
// initial value), effects never run, and nested function/lazy components
// are never auto-invoked — only the props (onClick, disabled, children,
// text) of the elements actually written in the component's JSX are
// inspectable, exactly as the component itself declares them.

/**
 * `stateOverrides`: an array positionally aligned to the component's
 * `useState` call order (1st call -> index 0, 2nd call -> index 1, ...).
 * `undefined` at a given index means "use that call's own initial value".
 * This is inherently coupled to the exact hook order in the component
 * source — if that order changes, a test relying on a specific index must
 * be updated too. Used only where a render needs to reach a branch gated
 * behind state that would otherwise start false/null (e.g. a modal that
 * starts closed).
 */
export function makeReactMocks({ stateOverrides = [] } = {}) {
  let stateIndex = 0
  const react = {
    createContext: () => ({}),
    useCallback: (fn) => fn,
    useContext: () => null,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (current) => ({ current }),
    useState: (initial) => {
      const idx = stateIndex++
      const override = stateOverrides[idx]
      return [override === undefined ? initial : override, () => {}]
    },
    lazy: (loader) => loader,
    Suspense: 'Suspense',
    Fragment: 'Fragment',
  }
  const jsxRuntime = {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
    Fragment: 'Fragment',
  }
  return { react, jsxRuntime }
}

/** Flattens a rendered node's text content (strings/numbers in children, recursively). */
export function collectText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object' && node.props?.children !== undefined) return collectText(node.props.children)
  return ''
}

/** Depth-first search of the rendered tree for every node matching `predicate`. */
export function findAll(node, predicate, out = []) {
  if (node == null || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, out)
    return out
  }
  if (predicate(node)) out.push(node)
  if (node.props?.children !== undefined) findAll(node.props.children, predicate, out)
  return out
}

/** Convenience: find the single node matching, or undefined. */
export function find(node, predicate) {
  return findAll(node, predicate)[0]
}
