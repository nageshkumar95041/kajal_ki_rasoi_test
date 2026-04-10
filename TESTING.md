# 🧪 Kajal Ki Rasoi — Testing Guide

Complete automated testing setup: unit, integration, component, E2E, and CI/CD.

---

## 📁 Test Structure

```
src/__tests__/
├── unit/                        # Pure logic, no I/O
│   ├── utils.test.ts            # escapeHTML, cart, token utils (35 tests)
│   └── auth.test.ts             # JWT sign/verify, requireAuth/Admin (19 tests)
│
├── integration/                 # API route handlers (DB + email mocked)
│   ├── auth-routes.test.ts      # POST /api/login, POST /api/register
│   └── orders-routes.test.ts    # GET /api/orders, PUT /api/orders/[id]/cancel
│
├── component/                   # React hooks + UI (JSDOM)
│   └── useAuth.test.tsx         # useAuth hook — all states + logout/refresh
│
├── e2e/                         # Playwright end-to-end flows
│   └── user-flows.spec.ts       # Login, menu, cart, nav, protected routes
│
└── __mocks__/
    ├── msw-handlers.ts          # MSW mock API handlers (reusable)
    └── styleMock.ts             # CSS import stub
```

---

## 🚀 Running Tests

### Install dependencies (first time)
```bash
npm install --ignore-scripts
```

### Unit tests
```bash
npm run test:unit
```

### Integration tests
```bash
npm run test:integration
```

### Component / hook tests
```bash
npm run test:component
```

### All tests with coverage report
```bash
npm run test:coverage
```

### Watch mode (re-runs on file save)
```bash
npm run test:watch
```

### E2E tests (locally — starts dev server automatically)
```bash
npx playwright install --with-deps   # first time only
npm run test:e2e
```

### E2E against your deployed feature branch
```bash
BASE_URL=https://your-branch.up.railway.app npm run test:e2e
```

### E2E with interactive UI debugger
```bash
npm run test:e2e:ui
```

---

## ⚙️ CI/CD — GitHub Actions

The pipeline at `.github/workflows/test.yml` runs automatically on:
- **Every push** to any branch → unit + integration + component + typecheck + lint
- **PRs to `main` or `develop`** → all of the above + E2E tests

### Jobs
| Job | What it checks | Blocks merge? |
|-----|---------------|---------------|
| `unit-integration` | Business logic, API route handlers | ✅ Yes |
| `component` | React hooks, UI behaviour | ✅ Yes |
| `typecheck` | TypeScript compile errors | ✅ Yes |
| `lint` | ESLint violations | ✅ Yes |
| `e2e` | Full user flows on deployed URL | PRs only |
| `regression-gate` | Summary gate — fails if any job fails | ✅ Yes |

### Required GitHub Secrets / Variables
| Name | Type | Purpose |
|------|------|---------|
| `JWT_SECRET` | Secret | Used in test env (falls back to a default if missing) |
| `FEATURE_BRANCH_URL` | Variable | Your Railway/Vercel preview URL for E2E |
| `RUN_E2E` | Variable | Set to `"true"` to run E2E on non-PR pushes |

---

## 🧩 Using MSW Mocks in New Tests

```typescript
import { server, MOCK_MENU_ITEMS } from '../__mocks__/msw-handlers';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('menu loads items', async () => {
  // fetch('/api/menu') will return MOCK_MENU_ITEMS automatically
});
```

---

## 📊 Coverage Thresholds

Configured in `jest.config.ts` — the CI build **fails** if coverage drops below:

| Metric | Minimum |
|--------|---------|
| Statements | 75% |
| Lines | 75% |
| Functions | 75% |
| Branches | 70% |

Run `npm run test:coverage` to see your current numbers.

---

## 🐛 Debugging a Failing Test

### Jest test
```bash
# Run a single file
npx jest src/__tests__/unit/auth.test.ts --verbose

# Run tests matching a name
npx jest -t "returns 401 when no auth token"
```

### Playwright E2E
```bash
# Visual debugger
npm run test:e2e:debug

# Headed browser (watch it run)
npm run test:e2e:headed

# View last failure screenshots/videos
npm run test:e2e:report
```

Failure artifacts (screenshots, videos, traces) are saved to `playwright-report/`
and uploaded to GitHub Actions artifacts for 14 days.

---

## ➕ Adding Tests for a New Feature

1. **New utility function** → add to `src/__tests__/unit/utils.test.ts`
2. **New API route** → add a file in `src/__tests__/integration/`
3. **New React component/hook** → add a `.test.tsx` in `src/__tests__/component/`
4. **New critical user flow** → add a `test()` block in `src/__tests__/e2e/user-flows.spec.ts`
5. **New API endpoint to mock** → add a handler in `src/__tests__/__mocks__/msw-handlers.ts`
