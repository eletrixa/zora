---
category: testing
scope: [zorasocial]
applies-to: [typescript, javascript]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# Testing Mock Boundaries

Mock external systems at boundaries, never mock your own code.

---

## Description

The "Don't Mock What You Don't Own" principle states that mocks should only be used for external dependencies (network, filesystem, time) at the system boundary. Mocking internal modules couples tests to implementation details and prevents catching real integration bugs.

---

## Specific Guidelines

### DO:
- Mock HTTP calls with MSW (Mock Service Worker)
- Mock filesystem operations
- Mock timers and Date with vi.useFakeTimers()
- Mock third-party libraries (stripe, etc.)
- Use real implementations of your own code
- Create test doubles for external services at boundary

### DON'T:
- Mock your own modules with vi.mock('./myModule')
- Spy on internal function calls
- Mock service classes to test controllers
- Use vi.mock() for anything in src/

---

## Benefits

1. **Catch real bugs**: Integration issues surface in tests
2. **Refactor safely**: Internal changes don't break tests
3. **Realistic testing**: Tests behave like production
4. **Less maintenance**: Fewer mocks to update

---

## Examples

### Correct: MSW for API mocking

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/octo-gateway/v1/products/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      title: 'Massage',
      retail_minor: 9900,
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ProductService', () => {
  test('fetches product from API', async () => {
    const service = new ProductService();
    const product = await service.getProduct('123');

    expect(product.title).toBe('Massage');
  });
});
```

### Correct: Mocking timers

```typescript
describe('Session expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('expires session after 30 minutes', () => {
    const session = createSession();
    
    expect(session.isValid()).toBe(true);
    
    vi.advanceTimersByTime(30 * 60 * 1000);
    
    expect(session.isValid()).toBe(false);
  });
});
```

### Incorrect: Mocking internal modules

```typescript
// BAD: Mocking your own service
vi.mock('@app/services/ProductService');

test('controller calls service', async () => {
  const mockService = vi.mocked(ProductService);
  mockService.getProduct.mockResolvedValue({ id: '1', title: 'Massage' });

  const result = await productController.getProduct('1');
  expect(mockService.getProduct).toHaveBeenCalledWith('1');
});

// GOOD: Test through the real service, mock at network
test('controller returns product data', async () => {
  server.use(
    http.get('/octo-gateway/v1/products/1', () => 
      HttpResponse.json({ id: '1', title: 'Massage' })
    )
  );

  const result = await productController.getProduct('1');
  expect(result.title).toBe('Massage');
});
```

