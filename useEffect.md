---
name: react-useeffect-alternatives
description: >
  Comprehensive guide for replacing misused React useEffect calls with better patterns.
  Use this skill whenever writing or reviewing React components that use useEffect, or when
  refactoring React code for performance. Trigger on: useEffect cleanup, React re-render
  optimization, derived state, data fetching patterns, state synchronization, React hooks
  best practices, "why does my component render twice", stale closure bugs, or any mention
  of replacing/removing/reducing useEffect usage. Also trigger when building new React
  components from scratch — consult this to avoid useEffect misuse from the start.
---

# Replacing `useEffect` with Better Patterns

## Core Principle

**`useEffect` is an escape hatch for synchronizing with external systems — not a lifecycle method, not a state manager, and not a data flow controller.**

The React mental model is declarative: UI is a function of state. Every `useEffect` that doesn't interact with something _outside_ React (DOM APIs, browser APIs, network, third-party libraries) is likely a code smell. Before writing `useEffect`, always ask:

> "Can React's rendering model handle this for me?"

If yes — don't reach for `useEffect`.

---

## Decision Tree

Run through this **before** writing any `useEffect`:

```
Is this derived from state or props?
  → YES → useMemo / inline computation (Pattern 1)

Is this triggered by a user action?
  → YES → event handler / useCallback (Pattern 2)

Is this shared state across components?
  → YES → useContext / state library (Pattern 3)

Is this server data fetching?
  → YES → React Query / SWR / RSC (Pattern 4)

Do I need to reset component state?
  → YES → key prop (Pattern 5)

Is this adjusting state during render?
  → YES → conditional set in render (Pattern 6)

Is this subscribing to an external store?
  → YES → useSyncExternalStore (Pattern 7)

Is this repeated effect logic?
  → YES → custom hook (Pattern 8)

Does this compare previous vs current values?
  → YES → useRef-based tracking (Pattern 9)

Is this synchronizing with the DOM or browser API?
  → YES → useEffect is correct ✅
```

---

## Pattern 1: Derived State → `useMemo` or Inline Computation

### When to Apply

You're computing a value from existing state/props and storing it in separate state via `useEffect` + `setState`.

**Red flag pattern:** _"When X changes, update Y"_ — where Y can be computed from X.

### ❌ Anti-pattern

```jsx
const [items, setItems] = useState([]);
const [filtered, setFiltered] = useState([]);

useEffect(() => {
  setFiltered(items.filter(i => i.active));
}, [items]);
```

**Problems:**
- Triggers an unnecessary extra render (first render with stale `filtered`, then re-render with updated `filtered`)
- `filtered` can briefly be out of sync with `items`
- More state to manage, more bugs to chase

### ✅ With `useMemo`

```jsx
const [items, setItems] = useState([]);

const filtered = useMemo(
  () => items.filter(i => i.active),
  [items]
);
```

### ✅ Even Simpler — Inline (When Cheap)

```jsx
// If the computation is trivial, skip useMemo entirely
const filtered = items.filter(i => i.active);
```

> **Rule of thumb:** Only reach for `useMemo` when the computation is expensive (large arrays, deep transforms, complex math). For cheap derivations, a plain variable during render is perfectly fine — `useMemo` itself has overhead.

### Advanced: Chained Derivations

```jsx
// ❌ Multiple useEffects chaining derived state
useEffect(() => setFiltered(items.filter(i => i.active)), [items]);
useEffect(() => setSorted(filtered.sort(byDate)), [filtered]);
useEffect(() => setPageItems(sorted.slice(0, pageSize)), [sorted, page]);

// ✅ Single derivation chain
const filtered = useMemo(() => items.filter(i => i.active), [items]);
const sorted = useMemo(() => [...filtered].sort(byDate), [filtered]);
const pageItems = useMemo(
  () => sorted.slice(page * pageSize, (page + 1) * pageSize),
  [sorted, page, pageSize]
);
```

---

## Pattern 2: Event Logic → Event Handlers / `useCallback`

### When to Apply

Logic that runs in response to a user interaction (click, submit, keypress, drag) is being placed inside `useEffect` instead of directly in the handler.

**Red flag pattern:** `useEffect` that contains interaction logic or calls functions that should run on user action.

### ❌ Anti-pattern

```jsx
const [submitted, setSubmitted] = useState(false);

useEffect(() => {
  if (submitted) {
    sendAnalytics('form_submit');
    navigate('/success');
    setSubmitted(false);
  }
}, [submitted]);
```

### ✅ Direct Event Handler

```jsx
const handleSubmit = (formData) => {
  saveData(formData);
  sendAnalytics('form_submit');
  navigate('/success');
};
```

### ✅ Stabilized with `useCallback` (for child props)

```jsx
const handleSubmit = useCallback((formData) => {
  saveData(formData);
  sendAnalytics('form_submit');
  navigate('/success');
}, [navigate]);
```

### When `useCallback` Actually Matters

`useCallback` prevents re-creation of the function reference on every render. **Only use it when:**

- Passing the function as a prop to a memoized child (`React.memo`)
- The function is a dependency of another hook
- You're seeing measurable performance issues from re-renders

Don't wrap every handler in `useCallback` by default — it adds complexity for no gain if the child isn't memoized.

---

## Pattern 3: Shared State → `useContext` / State Libraries

### When to Apply

You're using `useEffect` to sync state between sibling or distant components — "when A changes in component X, update B in component Y."

### ❌ Anti-pattern

```jsx
// Parent trying to keep children in sync
useEffect(() => {
  setSidebarSelection(mainPanelSelection);
}, [mainPanelSelection]);
```

### ✅ Lift State / Context

```jsx
const SelectionContext = createContext(null);

function App() {
  const [selection, setSelection] = useState(null);

  return (
    <SelectionContext.Provider value={{ selection, setSelection }}>
      <Sidebar />
      <MainPanel />
    </SelectionContext.Provider>
  );
}

function Sidebar() {
  const { selection } = useContext(SelectionContext);
  // Always in sync — no effect needed
}
```

### When to Graduate Beyond Context

Context re-renders every consumer on change. For high-frequency updates or deeply nested trees, consider:

- **Zustand** — Minimal, selector-based (avoids unnecessary re-renders)
- **Jotai** — Atomic state, great for independent pieces of state
- **Redux Toolkit** — When you need devtools, middleware, and time-travel debugging

---

## Pattern 4: Data Fetching → React Query / SWR / Server Components

### When to Apply

Fetching data from an API and managing loading/error/cache states manually inside `useEffect`.

### ❌ Anti-pattern

```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  let cancelled = false;

  setLoading(true);
  fetch('/api/users')
    .then(res => res.json())
    .then(data => {
      if (!cancelled) {
        setData(data);
        setLoading(false);
      }
    })
    .catch(err => {
      if (!cancelled) {
        setError(err);
        setLoading(false);
      }
    });

  return () => { cancelled = true; };
}, []);
```

**Problems:**
- Race conditions without the `cancelled` flag (easy to forget)
- No caching — refetches on every mount
- No retry logic, no background refetch, no deduplication
- Boilerplate explosion across components

### ✅ React Query (TanStack Query)

```jsx
import { useQuery } from '@tanstack/react-query';

function Users() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;
  return <UserList users={data} />;
}
```

### ✅ SWR (Lighter Alternative)

```jsx
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(r => r.json());

function Users() {
  const { data, error, isLoading } = useSWR('/api/users', fetcher);
  // Same benefits: caching, dedup, revalidation
}
```

### ✅ React Server Components (Next.js App Router / RSC)

```jsx
// app/users/page.tsx — runs on the server, no hooks needed
async function UsersPage() {
  const users = await fetch('/api/users').then(r => r.json());
  return <UserList users={users} />;
}
```

### Mutation Patterns

For POST/PUT/DELETE, use mutations instead of `useEffect`:

```jsx
const mutation = useMutation({
  mutationFn: (newUser) => fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(newUser),
  }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
});

// In handler — not in useEffect
const handleCreate = (formData) => mutation.mutate(formData);
```

---

## Pattern 5: Reset State → `key` Prop

### When to Apply

You want a component to "start fresh" when some identifier changes (e.g., switching between items in a list, opening a different form).

### ❌ Anti-pattern

```jsx
function EditForm({ userId }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    setName('');
    setEmail('');
    // Easy to forget new fields here
  }, [userId]);

  return <form>...</form>;
}
```

### ✅ Key Prop

```jsx
// Parent
<EditForm key={userId} userId={userId} />

// Child — no reset logic needed, clean mount every time
function EditForm({ userId }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return <form>...</form>;
}
```

**How it works:** Changing `key` tells React this is a _different_ component instance. React unmounts the old one and mounts a new one with fresh state. This is the idiomatic React way to reset.

### Gotcha

Heavy components with expensive mount logic (large forms with API calls, complex animations) may suffer from full remounts. In those rare cases, a controlled reset via `useReducer` with a RESET action can be preferable.

---

## Pattern 6: Conditional State Adjustment During Render

### When to Apply

A simple, synchronous state correction that should happen immediately — not after a render cycle.

### ✅ Correct Usage

```jsx
function Counter({ max }) {
  const [count, setCount] = useState(0);

  // Adjust immediately if max shrinks below current count
  if (count > max) {
    setCount(max);
  }

  return <span>{count}</span>;
}
```

### ⚠️ Rules

- **Must be guarded by a condition** — unconditional `setState` during render creates an infinite loop
- Keep it simple: one-liner corrections only
- If the logic is complex, it probably belongs in an event handler or `useMemo`
- React will re-render the component immediately (before committing to the DOM), so this is efficient

---

## Pattern 7: External Stores → `useSyncExternalStore`

### When to Apply

Subscribing to any state source that lives _outside_ React: browser APIs, third-party state libraries, vanilla JS stores, WebSocket connections.

### ❌ Anti-pattern

```jsx
const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  const handler = () => setIsOnline(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}, []);
```

### ✅ `useSyncExternalStore`

```jsx
import { useSyncExternalStore } from 'react';

function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
```

**Why this is better:**
- Works correctly with concurrent features (React 18+)
- Handles tearing (inconsistent reads during render)
- Provides `getServerSnapshot` for SSR support

### Common External Stores

- Browser: `matchMedia`, `navigator.onLine`, `document.visibilityState`, `localStorage`
- Libraries: Redux (already uses this internally), MobX, vanilla event emitters
- Custom: WebSocket message streams, shared workers

---

## Pattern 8: Reusable Logic → Custom Hooks

### When to Apply

You're copy-pasting the same `useEffect` + state setup across multiple components.

### ❌ Duplicated Logic

```jsx
// In ComponentA
const [width, setWidth] = useState(window.innerWidth);
useEffect(() => {
  const handler = () => setWidth(window.innerWidth);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// Same thing copied in ComponentB, ComponentC...
```

### ✅ Custom Hook

```jsx
function useWindowWidth() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => window.innerWidth
  );
}

// Usage — clean and declarative
function Sidebar() {
  const width = useWindowWidth();
  return width > 768 ? <FullSidebar /> : <MiniSidebar />;
}
```

### Hook Composition

Custom hooks can compose other custom hooks:

```jsx
function useResponsiveLayout() {
  const width = useWindowWidth();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  return { width, isMobile, isTablet, isDesktop };
}
```

---

## Pattern 9: Previous Value Tracking → `useRef`

### When to Apply

You need to compare the current value of a prop or state with its previous value to decide what to do.

### ❌ Anti-pattern

```jsx
const [prevCount, setPrevCount] = useState(count);

useEffect(() => {
  setPrevCount(count);
}, [count]);

// Now prevCount is always one render behind... sometimes
```

### ✅ `usePrevious` Hook

```jsx
function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}

// Usage
function Counter({ count }) {
  const prevCount = usePrevious(count);
  const direction = count > prevCount ? 'up' : 'down';
  return <span className={direction}>{count}</span>;
}
```

> **Note:** This is one of the few cases where `useEffect` is acceptable — it's synchronizing a ref with the render cycle, which is genuinely a side effect.

---

## Pattern 10: Debounced / Throttled Values → Custom Hook

### When to Apply

You're debouncing inside `useEffect` to avoid excessive updates (e.g., search input).

### ❌ Anti-pattern

```jsx
const [query, setQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(timer);
}, [query]);

useEffect(() => {
  if (debouncedQuery) fetchResults(debouncedQuery);
}, [debouncedQuery]);
```

### ✅ `useDeferredValue` (React 18+)

```jsx
import { useDeferredValue } from 'react';

function Search() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  // React handles the timing — renders with the deferred value
  // at lower priority, keeping the input responsive
  const results = useMemo(
    () => filterResults(deferredQuery),
    [deferredQuery]
  );

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ResultsList results={results} />
    </>
  );
}
```

### ✅ `useDebounce` Custom Hook (for API calls)

```jsx
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// Usage with React Query
function Search() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAPI(debouncedQuery),
    enabled: debouncedQuery.length > 2,
  });
}
```

---

## Pattern 11: Refs for Imperative DOM Access

### When to Apply

You need to interact with the DOM directly (focus, scroll, measure, animate) and you're using `useEffect` where a ref callback or event handler would suffice.

### ❌ Overusing `useEffect` for Focus

```jsx
const inputRef = useRef(null);

useEffect(() => {
  inputRef.current?.focus();
}, []);
```

### ✅ Ref Callback (No Effect Needed)

```jsx
<input ref={(el) => el?.focus()} />
```

### ✅ `autoFocus` Attribute (Simplest)

```jsx
<input autoFocus />
```

### When `useEffect` IS Correct for DOM

- Measuring layout after render (`getBoundingClientRect`)
- Setting up `IntersectionObserver` or `ResizeObserver`
- Integrating with non-React DOM libraries (D3, MapboxGL, etc.)

These are genuine external system synchronizations.

---

## When `useEffect` Is Actually Right

Not every `useEffect` is wrong. Here are legitimate uses:

| Use Case | Why It's Correct |
|---|---|
| Setting up event listeners on `window`/`document` | External system |
| WebSocket connections | External system |
| `IntersectionObserver` / `ResizeObserver` | Browser API |
| Third-party library init (map, chart, editor) | External system |
| Logging / analytics on mount | Side effect |
| `document.title` updates | DOM mutation |
| Cleanup on unmount | Teardown |

### Template for Legitimate `useEffect`

```jsx
useEffect(() => {
  // 1. Setup: connect to external system
  const connection = createConnection(roomId);
  connection.connect();

  // 2. Cleanup: disconnect when deps change or unmount
  return () => connection.disconnect();
}, [roomId]); // 3. Dependencies: re-sync when these change
```

---

## Code Review Checklist

When reviewing React code (or your own), flag any `useEffect` that:

- [ ] Calls `setState` with a value derived from props/state → **Pattern 1**
- [ ] Contains event handling logic (click, submit, etc.) → **Pattern 2**
- [ ] Syncs state between components → **Pattern 3**
- [ ] Fetches data with manual loading/error state → **Pattern 4**
- [ ] Resets state when an ID or key changes → **Pattern 5**
- [ ] Has an empty dependency array `[]` but doesn't touch external systems → Suspicious
- [ ] Has dependencies that change on every render (objects/arrays) → Likely stale closure or infinite loop bug
- [ ] Chains multiple `useEffect` calls (effect A → state → effect B) → Waterfall, refactor to single derivation

---

## Mental Model Summary

```
OLD: "When X changes, run this effect"
      ↓ imperative, error-prone, extra renders

NEW: "Given X, what should Y be?"
      ↓ declarative, in sync, single render
```

React is a rendering engine. Let it render. Reserve `useEffect` for the world outside React.
