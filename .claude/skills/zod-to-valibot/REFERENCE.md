# Zod → Valibot: Complete Pattern Reference

## Primitives

```ts
// Strings
z.string()                            → v.string()
z.string().email()                    → v.pipe(v.string(), v.email())
z.string().email().max(30)            → v.pipe(v.string(), v.email(), v.maxLength(30))
z.string().min(1).max(100)            → v.pipe(v.string(), v.minLength(1), v.maxLength(100))
z.string().url()                      → v.pipe(v.string(), v.url())
z.string().uuid()                     → v.pipe(v.string(), v.uuid())
z.string().regex(/pattern/)           → v.pipe(v.string(), v.regex(/pattern/))
z.string().trim()                     → v.pipe(v.string(), v.trim())  // note: trim is an action
z.string().toLowerCase()              → v.pipe(v.string(), v.toLowerCase())

// Numbers
z.number()                            → v.number()
z.number().min(0)                     → v.pipe(v.number(), v.minValue(0))
z.number().max(100)                   → v.pipe(v.number(), v.maxValue(100))
z.number().int()                      → v.pipe(v.number(), v.integer())
z.number().positive()                 → v.pipe(v.number(), v.minValue(1))
z.number().nonnegative()              → v.pipe(v.number(), v.minValue(0))
z.number().finite()                   → v.pipe(v.number(), v.finite())

// Others
z.boolean()                           → v.boolean()
z.date()                              → v.date()
z.null()                              → v.null()
z.undefined()                         → v.undefined()
z.unknown()                           → v.unknown()
z.any()                               → v.any()
z.never()                             → v.never()
z.void()                              → v.void()
z.bigint()                            → v.bigint()
z.symbol()                            → v.symbol()
z.literal('foo')                      → v.literal('foo')
```

## Objects

```ts
// Default: strips unknown keys
z.object({ name: z.string() })               → v.object({ name: v.string() })

// Strict: rejects unknown keys
z.object({...}).strict()                     → v.strictObject({...})

// Passthrough / loose: keeps unknown keys
z.object({...}).passthrough()                → v.looseObject({...})

// With rest validator on unknown keys
z.object({...})                              → v.objectWithRest({...}, v.string())
// (no direct Zod equiv — use when unknown keys must match a type)

// Utilities
baseSchema.pick({ id: true, name: true })    → v.pick(baseSchema, ['id', 'name'])
baseSchema.omit({ email: true })             → v.omit(baseSchema, ['email'])
baseSchema.partial()                         → v.partial(baseSchema)
baseSchema.required()                        → v.required(baseSchema)
baseSchema.merge(other)                      → v.merge([baseSchema, other])
baseSchema.extend({ role: z.string() })      → v.merge([baseSchema, v.object({ role: v.string() })])
```

## Arrays & Tuples

```ts
z.array(z.string())                   → v.array(v.string())
z.array(z.string()).min(1)            → v.pipe(v.array(v.string()), v.minLength(1))
z.array(z.string()).max(10)           → v.pipe(v.array(v.string()), v.maxLength(10))
z.array(z.string()).nonempty()        → v.pipe(v.array(v.string()), v.nonEmpty())
z.tuple([z.string(), z.number()])     → v.tuple([v.string(), v.number()])
```

## Optional, Nullable, Nullish, Default

```ts
z.string().optional()                 → v.optional(v.string())
z.string().nullable()                 → v.nullable(v.string())
z.string().nullish()                  → v.nullish(v.string())

// Default values (applied when value is undefined)
z.string().default('foo')             → v.optional(v.string(), 'foo')
z.string().default(() => 'foo')       → v.optional(v.string(), () => 'foo')  // factory fn

// Fallback (applied when validation FAILS — different from default)
// No Zod equiv                       → v.fallback(v.string(), 'fallback')
// Fallback values bypass validation; defaults still go through validation
```

## Union & Discriminated Union

```ts
z.union([z.string(), z.number()])
  → v.union([v.string(), v.number()])

z.discriminatedUnion('type', [
  z.object({ type: z.literal('a'), val: z.string() }),
  z.object({ type: z.literal('b'), val: z.number() }),
])
  → v.variant('type', [
      v.object({ type: v.literal('a'), val: v.string() }),
      v.object({ type: v.literal('b'), val: v.number() }),
    ])
```

## Enums

```ts
// String arrays
z.enum(['active', 'inactive'])        → v.picklist(['active', 'inactive'])

// TypeScript enums
enum Status { Active = 'active' }
z.nativeEnum(Status)                  → v.enum(Status)
```

## Records

```ts
z.record(z.string())                  → v.record(v.string(), v.string())
z.record(z.string(), z.number())      → v.record(v.string(), v.number())
// Note: Valibot always requires explicit key schema (first arg)
```

## Transforms

```ts
z.string().transform(s => s.toUpperCase())
  → v.pipe(v.string(), v.transform(s => s.toUpperCase()))

z.string().transform(Number)
  → v.pipe(v.string(), v.transform(Number))
```

## Coercion

```ts
z.coerce.number()
  → v.pipe(v.unknown(), v.transform(Number), v.number())

z.coerce.boolean()
  → v.pipe(v.unknown(), v.transform(Boolean), v.boolean())

z.coerce.date()
  → v.pipe(v.union([v.instance(Date), v.string()]),
           v.transform(val => val instanceof Date ? val : new Date(val)),
           v.instance(Date))
```

## Refinements / Custom Validation

```ts
// Simple boolean check
z.string().refine(val => val.length >= 8, 'Too short')
  → v.pipe(v.string(), v.check(val => val.length >= 8, 'Too short'))

// Cross-field validation (route error to specific field)
z.object({ password: z.string(), confirm: z.string() })
 .refine(d => d.password === d.confirm, {
   message: "Passwords don't match",
   path: ['confirm'],
 })
  →
v.pipe(
  v.object({ password: v.string(), confirm: v.string() }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirm']],
      d => d.password === d.confirm,
      "Passwords don't match"
    ),
    ['confirm']
  )
)

// Maximum control (add issues manually)
z.string().superRefine((val, ctx) => {
  if (val.length < 8) ctx.addIssue({ code: 'custom', message: 'Too short' })
})
  →
v.pipe(
  v.string(),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed && dataset.value.length < 8)
      addIssue({ message: 'Too short' })
  })
)
```

## Parsing & Error Handling

```ts
// Throwing parse
schema.parse(data)                    → v.parse(schema, data)

// Safe parse
const r = schema.safeParse(data)
r.success
r.data                                → r.output
r.error.errors                        → r.issues
r.error.errors[0].message             → r.issues[0].message
r.error.errors[0].path                → r.issues[0].path

// Async
await schema.parseAsync(data)         → await v.parseAsync(schema, data)
await schema.safeParseAsync(data)     → await v.safeParseAsync(schema, data)

// Error type
import { ZodError } from 'zod'        → import { ValiError } from 'valibot'
error instanceof ZodError             → error instanceof ValiError
```

## Type Inference

```ts
z.infer<typeof schema>                → v.InferOutput<typeof schema>
z.input<typeof schema>                → v.InferInput<typeof schema>
// InferInput ≠ InferOutput when transforms change the type
```

## Async Schemas

When validation involves async operations (DB lookups, API calls), use async variants:

```ts
// Zod: regular schema + async refine
const schema = z.object({
  username: z.string().refine(async val => !(await exists(val)), 'Taken'),
})
await schema.safeParseAsync(data)

// Valibot: *Async variants required throughout
const schema = v.objectAsync({
  username: v.pipeAsync(
    v.string(),
    v.checkAsync(async val => !(await exists(val)), 'Taken')
  ),
})
await v.safeParseAsync(schema, data)
// objectAsync, pipeAsync, checkAsync, transformAsync, etc.
```

## Recursive / Lazy Schemas

```ts
// Zod
type Node = { value: string; children?: Node[] }
const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.object({ value: z.string(), children: z.array(nodeSchema).optional() })
)

// Valibot — requires explicit generic type annotation
type Node = { value: string; children?: Node[] }
const nodeSchema: v.GenericSchema<Node, Node> = v.object({
  value: v.string(),
  children: v.optional(v.array(v.lazy(() => nodeSchema))),
})
```

## Intersections

```ts
z.intersection(a, b)                  → v.intersect([a, b])
a.and(b)                              → v.intersect([a, b])
// For object merging, prefer v.merge([a, b]) — more efficient
```

## Custom error messages

```ts
// Zod: per-validator message object or string
z.string({ required_error: 'Required' })
z.string().email('Bad email')

// Valibot: single string per validator, on the schema itself or the action
v.string('Must be a string')
v.pipe(v.string('Must be a string'), v.email('Bad email'))
```

## Common gotchas

- **`v.fallback` ≠ default**: `fallback` fires when validation fails; `optional(schema, default)` fires for `undefined`. Fallback values skip validation; defaults do not.
- **`pick`/`omit` return new schemas**: You cannot call `pipe()` directly on their result without wrapping: `v.pipe(v.pick(schema, ['x']), ...)`.
- **Async propagates**: If any action is async, the whole schema must use async variants (`pipeAsync`, `objectAsync`, etc.).
- **`v.object` strips unknown keys by default** (same as Zod). Use `v.looseObject` to pass them through, `v.strictObject` to reject them.
- **`minLength` vs `minValue`**: `minLength` is for strings/arrays (counts length); `minValue` is for numbers (compares value).
