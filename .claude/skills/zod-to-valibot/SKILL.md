---
name: zod-to-valibot
description: Migrate TypeScript validation code from Zod to Valibot. Use when user asks to migrate, convert, or replace Zod with Valibot, or when editing files that import from 'zod'. Handles all common patterns: schemas, pipes, parsing, type inference, error handling, async, and cross-field validation.
---

# Zod → Valibot Migration

## Quick start

```ts
// Before
import { z } from 'zod'
const schema = z.string().email().max(30)
type Schema = z.infer<typeof schema>
const result = schema.safeParse(input)
if (!result.success) console.log(result.error.errors)
else console.log(result.data)

// After
import * as v from 'valibot'
const schema = v.pipe(v.string(), v.email(), v.maxLength(30))
type Schema = v.InferOutput<typeof schema>
const result = v.safeParse(schema, input)
if (!result.success) console.log(result.issues)
else console.log(result.output)
```

## Migration workflow

1. Replace import: `import { z } from 'zod'` → `import * as v from 'valibot'`
2. Convert schemas (see [REFERENCE.md](REFERENCE.md) for all patterns)
3. Update parse calls: `schema.parse(x)` → `v.parse(schema, x)`
4. Update type inference: `z.infer<T>` → `v.InferOutput<T>`
5. Update error access: `result.error.errors` → `result.issues`, `result.data` → `result.output`
6. Run `tsc --noEmit` to catch any remaining type errors

## Core concept: pipe() replaces method chaining

The biggest mental shift: Zod chains methods on a schema; Valibot composes actions through `pipe()`.

```ts
// Zod
z.string().trim().toLowerCase().email().min(5)

// Valibot
v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email(), v.minLength(5))
```

## Key renames

| Zod | Valibot | Notes |
|-----|---------|-------|
| `z.enum(['a','b'])` | `v.picklist(['a','b'])` | For string arrays |
| `z.nativeEnum(Enum)` | `v.enum(Enum)` | For TS enums |
| `z.discriminatedUnion('type', [...])` | `v.variant('type', [...])` | |
| `.refine(fn, msg)` | `v.check(fn, msg)` | In a pipe |
| `.superRefine(fn)` | `v.rawCheck(fn)` | Full control |
| `z.infer<T>` | `v.InferOutput<T>` | |
| `z.input<T>` | `v.InferInput<T>` | |
| `.default(x)` | `v.optional(schema, x)` | Default for undefined |
| `z.coerce.number()` | `v.pipe(v.string(), v.transform(Number), v.number())` | |

See [REFERENCE.md](REFERENCE.md) for full pattern catalog with before/after examples.
