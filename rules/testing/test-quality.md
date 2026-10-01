---
category: testing
scope: [zorasocial]
applies-to: [typescript, javascript]
---

> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.

# Test Quality - TEST-SOLID + AAA Pattern

**Goal**: Tests that are readable, reliable, and maintainable.

---

## TEST-SOLID Principles

### S -- Simple

**Rule**: Test must be readable in **10 seconds** and understandable.

```typescript
// BAD: Complex, hard to follow
test('complex test', async () => {
  const a = await fetch('/api/x');
  const b = JSON.parse(a);
  if (b.status === 200) {
    const c = b.data.filter(x => x.active);
    const d = c.map(x => x.id);
    expect(d).toContain('123');
  }
});

// GOOD: Clear intent
test('returns active product IDs', async () => {
  const response = await fetchProducts();
  const activeIds = getActiveProductIds(response.data);
  
  expect(activeIds).toContain('123');
});
```

### O -- One Reason to Fail

**Rule**: One test = one main failure reason.

```typescript
// BAD: Multiple unrelated assertions
test('product creation', () => {
  const product = createProduct();
  expect(product.id).toBeDefined();
  expect(product.title).toMatch(/^.{1,}$/);
  expect(database.products).toHaveLength(1); // Different concern!
});

// GOOD: Focused tests
test('creates product with valid properties', () => {
  const product = createProduct();
  expect(product.id).toBeDefined();
  expect(product.title).toMatch(/^.{1,}$/);
});

test('persists product to database', () => {
  createProduct();
  expect(database.products).toHaveLength(1);
});
```

### L -- Low Duplication

**Rule**: Move repetitive setup to factories and helpers.

```typescript
// GOOD: Use factory
const createTestProduct = (overrides = {}) => ({
  id: `prod-${Math.random().toString(36).slice(2)}`,
  title: 'Test Product',
  retail_minor: 9900,
  ...overrides,
});

test('lists products', () => {
  const product = createTestProduct();
  expect(product.retail_minor).toBeGreaterThan(0);
});
```

### I -- Isolated from Infrastructure

**Rule**: Unit tests don't communicate with real systems.

```typescript
// GOOD: Mocked at boundary
test('saves product', async () => {
  const mockDb = { save: vi.fn() };
  const service = new ProductService(mockDb);
  
  await service.createProduct(data);
  
  expect(mockDb.save).toHaveBeenCalledWith(expect.objectContaining(data));
});
```

### D -- Domain-Oriented

**Rule**: Tests speak the language of your domain.

```typescript
// GOOD: Domain language
test('can list active products', () => {
  const product = createProduct({ status: 'active' });
  expect(product.isListable()).toBe(true);
});
```

---

## AAA Pattern: Arrange -- Act -- Assert

**Every test should have three clear sections:**

```typescript
test('user can create checkout', async () => {
  // ===== ARRANGE =====
  const user = createTestUser();
  const product = createTestProduct({ retail_minor: 9900 });
  await addToCart(user, product);

  // ===== ACT =====
  const checkout = await createCheckout(user, { 
    expectedPrice: 9900
  });

  // ===== ASSERT =====
  expect(checkout.status).toBe('created');
  expect(checkout.buyLink).toBeDefined();
});
```

---

## Test Factories

Avoid manual object creation in every test:

```typescript
export function createTestProduct(overrides = {}): Product {
  return {
    id: `prod-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Product',
    retail_minor: 9900,
    status: 'active',
    ...overrides,
  };
}

// Usage in tests
const product = createTestProduct();
const expensive = createTestProduct({ retail_minor: 99900 });
```

---

## Checklist

Before merging tests:

- [ ] **S**: Test readable in 10 seconds?
- [ ] **O**: One main failure reason per test?
- [ ] **L**: Using factories (no copy-paste setup)?
- [ ] **I**: Mocked external systems (DB, API)?
- [ ] **D**: Uses domain language?
- [ ] AAA pattern clear?

