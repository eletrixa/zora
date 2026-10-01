---
category: testing
scope: [zorasocial]
applies-to: [typescript, javascript]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# FIRST Principles for Tests

**Acronym**: Fast, Independent, Repeatable, Self-validating, Timely

**Purpose**: Ensure tests are reliable and maintainable.

---

## F -- Fast

**Rule**: Tests must run quickly (seconds, not minutes).

```bash
# GOOD: Unit test suite
bun run test
```

**Why**: Fast feedback loop = productive development

**Guidelines**:
- Unit tests: <1ms each
- Integration tests: 10-100ms each
- Mocks required for network/time-dependent code

---

## I -- Independent

**Rule**: Tests MUST NOT depend on each other.

### BAD: Tests depend on order

```typescript
let globalUser: User;

test('creates user', () => {
  globalUser = createUser({ name: 'John' });
  expect(globalUser).toBeDefined();
});

test('updates user', () => {
  globalUser.name = 'Jane'; // DEPENDS ON PREVIOUS TEST!
  expect(globalUser.name).toBe('Jane');
});
```

### GOOD: Independent tests

```typescript
describe('User operations', () => {
  test('creates user', () => {
    const user = createUser({ name: 'John' });
    expect(user).toBeDefined();
  });

  test('updates user', () => {
    const user = createUser({ name: 'John' }); // Own setup!
    user.name = 'Jane';
    expect(user.name).toBe('Jane');
  });
});
```

---

## R -- Repeatable

**Rule**: Same results every time, everywhere.

### GOOD: Deterministic tests

```typescript
// Fixed data
test('creates user with ID', () => {
  const user = createTestUser();
  expect(user.id).toBeDefined();
});

// Mock time
test('checks expiry', () => {
  vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  const now = new Date();
  const expiry = addDays(now, 7);
  expect(expiry.toISOString()).toBe('2024-01-08T00:00:00.000Z');
  vi.useRealTimers();
});

// Mock network
test('fetches deal', async () => {
  server.use(
    http.get('/api/products/123', () => {
      return HttpResponse.json({ id: '123', title: 'Massage' });
    })
  );

  const deal = await fetchDeal('123');
  expect(deal.title).toBe('Massage');
});
```

---

## S -- Self-Validating

**Rule**: Test either PASSES or FAILS, no manual inspection.

### GOOD: Automated validation

```typescript
test('creates valid product', () => {
  const product = createProduct();

  expect(product.id).toBeDefined();
  expect(product.title).toMatch(/^.{1,}$/);
  expect(product.retail_minor).toBeGreaterThan(0);
});
```

---

## T -- Timely

**Rule**: Write tests WHEN the problem is fresh in your mind.

Test-Driven Development (TDD):
1. Write test first (RED)
2. Implement to pass test (GREEN)
3. Refactor (REFACTOR)

---

## Quick Checklist

Before merging tests, verify:

- [ ] **F**: Tests run quickly?
- [ ] **I**: Tests run independently (no shared state)?
- [ ] **R**: Tests use deterministic data (no random/time/network)?
- [ ] **S**: Tests have assertions (pass/fail is clear)?
- [ ] **T**: Tests written when feature was fresh?
