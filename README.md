# Piper 🚰

**A tiny, weird, functional language where everything flows through pipes**

Piper is a toy language that takes one idea and runs with it: what if _every_ function call was a pipeline? No parentheses, no function application, just data flowing through transformations like water through pipes. It's like Unix pipes met F# met that one guy who wants to write all his code backwards.

## Why Would Anyone Do This?

Good question! Piper is an experiment in pushing the pipe operator to its logical extreme. I was curious if this would make an elegant language or ugly. You can decide the results.

- **Only unary functions** - Every function takes exactly one argument. Multiple arguments are handled via currying
- **Only pipelines** - No `f(x)`. Only `x |> f`.
- **Recursion!** - Functions can call themselves because we're not monsters.
- **Immutable bindings** - Can't rebind a `const`, but you can shadow it with new data.
- **Mostly immutable** - Most data is immutable by default. There are a few explicitly mutable data structures.
- **2 Pipe operators** - `|>` for normal pipes, `<|` for staging and back-piping. Does that get confusing? Yes.

## Quick Start

```bash
npm install
npm run build
./dist/piper run examples/hello.piper
```

## Your First Piper Program

```piper
"Hello, Piper!" |> print
```

That's it. The string flows into `print`, which prints it.

## The Big Ideas

### 1. Pipelines Are Everything

In normal languages you write `f(g(h(x)))`. In Piper you write:

```piper
x |> h |> g |> f
```

Data flows left to right through each function.

```piper
-- Triple a number
5 |> (\x -> x * 3) |> print  -- 15

-- Chain operations
[1 2 3 4 5]
  |> map <| (\x -> x * 2)
  |> filter <| (\x -> x > 5)
  |> print  -- [6 8 10]
```

### 2. Functions Are Curried

Every function takes exactly one argument. For multiple arguments, you chain lambdas:

```piper
-- This function takes 'a', returns a function that takes 'b'
const add = \a -> \b -> a + b

-- Use the <| operator to stage arguments
5 |> add <| 10  -- 15
```

### 3. Staging and Back-piping

The `<|` operator works in two ways:

**Staging** - Partially applying arguments

Staging lets you apply some arguments to a function, creating a new function that you can pipe to.

```piper
const add = \a -> \b -> a + b

-- Stage one argument
const add10 = add <| 10
5 |> add10 |> print  -- 15

-- Or stage inline
5 |> add <| 10 |> print  -- 15

-- Multiple arguments
const sum3 = \a -> \b -> \c -> a + b + c
const result = 1 |> sum3 <| 2 3
result |> print -- 6

const greet = \greeting -> \name -> \punct ->
  greeting |> " " <| concat |> name <| concat |> punct <| concat

const sayHello = greet <| "Hello" "World"
"!" |> sayHello |> print  -- "Hello World!"
```

**Back-piping** - Syntactic sugar for precedence:

When you use `<|`, it binds tighter than `|>`, forcing the right side to evaluate first.

```piper
-- Without back-piping, this would parse left-to-right:
-- 5 |> 10 |> add  -- Error! (tries to pipe 5 into 10)

-- Back-piping groups it correctly:
5 |> 10 <| add     -- 15
5 |> (10 |> add)   -- Same thing with explicit parens

-- Useful for creating functions
const add10 = 10 <| add  -- Same as (10 |> add)
5 |> add10 |> print  -- 15
```

**Staging** partially applies arguments. **Back-piping** is just precedence: `a |> b <| f` means `a |> (b |> f)`. Should I have overloaded this operator? No. Would it be better if I picked one and dropped the other. Yes. But I committed to overusing pipes and this is where I ended up.

### 4. No Loops. Only Recursion.

There are no `for` loops. No `while` loops. No `do-while`. No `foreach`. No `loop`. Nothing.

If you want to repeat something, you write a function that calls itself.

```piper
-- "loop" from 0 to 10
const printRange = \n ->
  if n > 10
  then ()
  else (n |> print) |> (\_ -> (n + 1) |> printRange)

0 |> printRange  -- prints 0 through 10

-- "loop" doubling until > 100
const doubleUntil = \n ->
  if n > 100
  then n
  else (n * 2) |> doubleUntil

1 |> doubleUntil |> print  -- 128
```

This isn't a limitation, it's the entire point. Loops are imperative. They mutate counters. They don't compose. I'm choosing functional declarative ideas over imperative ones for Piper. In a language built entirely on function composition, recursion makes way more sense.

Want to iterate over a list? Use `map`, `filter`, or `fold`. Want to repeat something N times? Write a recursive function. Want to complain about stack overflows? Piper isn’t real. It _could_ support TCO, but whatever, it’s a toy.

## Language Tour

### Numbers and Math

```piper
-- Basic math
3 + 5 |> print           -- 8
10 - 3 |> print          -- 7
4 * 5 |> print           -- 20
10 / 2 |> print          -- 5
10 % 3 |> print          -- 1

-- Exponentiation (right-associative!)
2 ** 10 |> print         -- 1024
2 ** 3 ** 2 |> print     -- 512 (that's 2^(3^2), not (2^3)^2)

-- Precedence works like you'd expect
2 + 3 * 4 |> print       -- 14
3 * 2 ** 4 |> print      -- 48
```

### Comparisons

Piper uses `=` for equality and for assignment because if I can reuse an operator for 2 different things, I'm gonna.

```piper
5 = 5 |> print           -- true
10 > 5 |> print          -- true
3 < 10 |> print          -- true

-- Equality works on all types
"hello" = "hello" |> print  -- true
[1 2 3] = [1 2 3] |> print  -- true
true = false |> print       -- false

-- Great for conditionals!
const max = \a -> \b ->
  if a > b then a else b

10 |> max <| 20 |> print -- 20
```

### Lists

Standard list operations:

```piper
const nums = [1 2 3 4 5]

nums |> head |> print    -- 1
nums |> tail |> print    -- [2 3 4 5]
nums |> length |> print  -- 5

-- Cons prepends elements
0 |> nums <| cons |> print  -- [0 1 2 3 4 5]
```

### Higher-Order Functions

Map, filter, and fold work as expected:

```piper
-- Map (function argument - must use staging)
[1 2 3]
  |> map <| (\x -> x * 2)
  |> print  -- [2 4 6]

-- Filter (function argument - must use staging)
[1 5 2 8 3 9]
  |> filter <| (\x -> x > 5)
  |> print  -- [8 9]

-- Fold (multiple arguments - use staging)
[1 2 3 4 5]
  |> fold <| 0 (\acc -> \x -> acc + x)
  |> print  -- 15
```

Use staging (`function <| arguments`) to partially apply higher-order functions.

### Defining Functions

All functions are lambdas. The syntax is `\param -> body`:

```piper
-- Simple function
const double = \x -> x * 2

-- Multiple "parameters" via currying
const multiply = \a -> \b -> a * b

-- Use it
3 |> multiply <| 4 |> print  -- 12

-- Or make specialized versions
const triple = 3 <| multiply
5 |> triple |> print  -- 15
```

### Mutable Data

**In Piper, all data is immutable with three exceptions: records, spans, and boxes.**

#### Immutable Bindings (But You Can Shadow)

Bindings are immutable. You can't rebind a `const`, but you can shadow it:

```piper
const ten = 10
const addTen = \x -> x + ten

-- Shadow ten with a new binding
const ten = 20

-- The closure still captured the original value
5 |> addTen |> print  -- 15, not 25!
```

Each `const` creates a new environment layer. Closures capture their lexical environment, so shadowing doesn't affect previously defined closures.

#### Records: Mutable Key-Value Structures

Records use `{...}` syntax and allow mutable field updates:

```piper
const person = {name = "Alice" age = 30}

person |> "name" <| get |> print  -- Alice

-- Mutate the record (returns the record for chaining)
person |> set <| "age" 31
person |> "age" <| get |> print  -- 31 (the record was mutated)
```

#### Spans: Fixed size, mutable storage

Spans use `#[...]` syntax and provide efficient indexed access and mutation:

```piper
const s = #[1 2 3 4 5]

-- Get element by index (0-based)
s |> 0 <| get |> print  -- 1

-- Get last element
s |> getLast |> print  -- 5

-- Set element (mutates the span)
s |> set <| 0 10
s |> print  -- #[10, 2, 3, 4, 5]

-- Set last element (mutates the span)
s |> setLast <| 99
s |> print  -- #[10, 2, 3, 4, 99]

-- Slice returns a new span
s |> slice <| 1 3 |> print  -- #[2, 3]

-- Slice with -1 excludes last element
s |> slice <| 0 (-1) |> print  -- #[10, 2, 3, 4]

-- Concatenate spans (returns new span)
#[1 2 3] |> #[4 5 6] <| concat |> print  -- #[1, 2, 3, 4, 5, 6]
```

**Spans are fixed-length.** You can mutate elements with `set`, but you can't change the size. Want to "push" or "pop"? Create a new span:

```piper
-- User-space push: append element, return new span
const spanPush = \val -> \span ->
  span |> #[val] <| concat

-- User-space pop: remove last element, return [value, new_span]
const spanPop = \span ->
  [(span |> getLast) (span |> slice <| 0 (-1))]

const s = #[1 2 3]
const s2 = s |> 4 <| spanPush    -- #[1, 2, 3, 4]
const result = s2 |> spanPop      -- [4, #[1, 2, 3]]
result |> head |> print          -- 4 (popped value)
result |> tail |> head |> print  -- #[1, 2, 3] (new span)
```

These operations create _new_ spans. The original span is unchanged. This is intentional: spans are for efficient indexed access and in-place mutation of fixed-size data, not for growing/shrinking sequences.

**Convert between lists and spans:**

```piper
const list = [1 2 3]
const span = list |> to_span
span |> print  -- #[1, 2, 3]

span |> to_list |> print  -- [1, 2, 3]
```

**Note:** Spans are for random access and mutation. That's it. No `length`, no `map`, no `filter`, no `fold`. Want to iterate? Convert to a list with `to_list` first. This isn't a limitation, it's a feature. If your data structure supports every operation under the sun, you haven't designed anything, you've just built a blob. Spans do one thing well: mutable indexed storage. Lists do one thing well: immutable iteration. Pick the right tool!

#### Boxes: "Mutable Variables"

Want to "reassign" a variable? Use a box!

```piper
-- Create a box
const x = #[42]

-- Read the value stored in the box
x |> unbox |> print  -- 42

-- Update the value stored in the box
x |> box <| 100
x |> unbox |> print  -- 100

-- Use in functions
const counter = #[0]
const increment = \_ ->
  counter |> unbox
    |> (\n -> counter |> box <| (n + 1))

() |> increment
() |> increment
counter |> unbox |> print  -- 2

const num = #[10]
const addNum = \x -> x + (num |> unbox)

-- update num
num |> box <| 20

-- The function uses the updated value
5 |> addNum |> print  -- 25
```

**Plot twist:** Boxes aren't special! They're just spans with a single value! `#[value]` is a span literal, and you use `unbox` and `box` to read and write the only element.

**Another Plot twist:** `unbox` and `box` are just aliases for `getLast` and `setLast`! No new functions or data structures are needed for mutable variables in Piper.

### Conditionals

In Piper, `if-then-else` is an **expression**, not a statement. It always returns a value.

```piper
const abs = \x ->
  if x < 0
  then 0 - x
  else x

(-42) |> abs |> print  -- 42

const sign = \x ->
  if x > 0
  then "positive"
  else if x < 0
  then "negative"
  else "zero"

5 |> sign |> print  -- "positive"

-- Using and in conditionals
const isWarmDay = \temp ->
  if ((temp > 60) |> and <| (temp < 80))
  then "comfortable"
  else "too cold or hot"

70 |> isWarmDay |> print  -- "comfortable"
90 |> isWarmDay |> print  -- "too cold or hot"
```

Unlike imperative languages where `if` controls which code blocks execute, Piper's `if-then-else` evaluates to a value. Both `then` and `else` branches are required (because an expression must always produce a value), and you can use it anywhere—nested in pipelines, as function arguments, inside other expressions. It's declarative! You're not telling the computer what to do, you're describing what value to compute.

#### Boolean Logic with `and` and `or`

Combine conditions using `and` and `or`:

```piper
-- Check if number is in range
const inRange = \x ->
  (x > 0) |> and <| (x < 100)

50 |> inRange |> print  -- true
150 |> inRange |> print  -- false

-- Check if eligible to vote (age 18+ and citizen)
const canVote = \age -> \isCitizen ->
  (age > 18) |> and <| isCitizen

true |> 21 <| canVote |> print   -- true
true |> 16 <| canVote |> print   -- false

-- Weekend checker
const isWeekend = \day ->
  (day = "Saturday") |> or <| (day = "Sunday")

"Saturday" |> isWeekend |> print  -- true
"Monday" |> isWeekend |> print    -- false
```

## Examples

### Fibonacci

```piper
const fib = \n ->
  if n < 2
  then n
  else (n - 1 |> fib) + (n - 2 |> fib)

10 |> fib |> print  -- 55
```

### FizzBuzz

```piper
const fizzbuzzValue = \n ->
  if (n % 15) = 0
  then "FizzBuzz"
  else if (n % 3) = 0
  then "Fizz"
  else if (n % 5) = 0
  then "Buzz"
  else n |> show

const fizzbuzz = \n ->
  if n < 1
  then ()
  else (n |> fizzbuzzValue |> print) |> (\_ -> (n - 1) |> fizzbuzz)

15 |> fizzbuzz  -- FizzBuzz 14 13 Fizz 11 Buzz ...
```

### Working with Lists

```piper
-- Find the sum of even squares under 1000
const isEven = \n -> (n % 2) = 0
const square = \n -> n * n
const under1000 = \n -> n < 1000

[1 2 3 4 5 6 7 8 9 10]
  |> map <| square
  |> filter <| under1000
  |> filter <| isEven
  |> fold <| 0 (\acc -> \x -> acc + x)
  |> print  -- 220
```

## Running Piper Code

### Interpreter Mode

```bash
./dist/piper run myprogram.piper
```

### Compile to JavaScript

```bash
./dist/piper compile myprogram.piper > output.js
node output.js
```

This generates readable JavaScript. Useful for understanding what the code does.

### See the AST

```bash
./dist/piper parse myprogram.piper
```

## Built-in

### Operators

**Math:**

- `+`, `-`, `*`, `/`, `%` - The usual suspects
- `**` - Exponentiation (2 \*\* 8 = 256)
- Unary `-` for negative numbers

**Comparisons:**

- `=` - Equal to (works on all types: numbers, strings, booleans, lists, spans)
- `>` - Greater than (numbers only)
- `<` - Less than (numbers only)

### Functions

**Lists:**

- `head` - First element
- `tail` - Everything but the first
- `cons` - Prepend an element
- `length` - Count the elements
- `map` - Transform each element
- `filter` - Keep only matching elements
- `fold` - Reduce to a single value
- `to_span` - Convert list to span

**Strings:**

- `concat` - Join two strings

**Records:**

- `get` - Access a field from a record
- `set` - Update a field in a record (mutates the record)

**Spans:**

- `get` - Access element by index
- `set` - Update element by index (mutates the span)
- `slice` - Extract subspan (returns new span; end of -1 excludes last)
- `concat` - Concatenate two spans (returns new span)
- `to_list` - Convert span to list
- `getLast` - Get last element from span
- `setLast` - Set last element in span (mutates)

**Boxes:**

- `unbox` - Alias for `getLast` (read last element)
- `box` - Alias for `setLast` (write last element)

**Boolean operations:**

- `and` - Logical AND (both arguments must be booleans)
- `or` - Logical OR (both arguments must be booleans)

**I/O:**

- `print` - Print to console
- `show` - Convert to string

## Syntax Cheat Sheet

```piper
-- Comments
-- Use double-dash for line comments
{- Or curly-braces-dash for
   block comments -}

-- Values
42                        -- Integer
3.14                      -- Float
"hello"                   -- String
true / false              -- Booleans
()                        -- Unit (like null)
[1 2 3]                   -- List
{x = 10 y = 20}           -- Record
#[1 2 3]                  -- Span
#[42]                     -- Box (single element Span)

-- Variables (constants, really)
const x = 42

-- Functions
const f = \x -> x + 1

-- Pipelines
x |> f |> g |> h

-- Staging (function <| arguments)
f <| arg                  -- Partial application
x |> f <| arg1 arg2       -- Multiple staged arguments

-- Back-piping (value <| function)
x |> val <| f             -- Same as x |> (val |> f)

-- Conditionals
if x > 0 then 1 else -1

-- Top-level shortcuts
"Hi!" |> print            -- Starts with (), implicitly
|> print <| "Hi!"         -- Also works
```

## What Piper Doesn't Have

- **No pattern matching** - Use `if-then-else`
- **No type system** - Everything is dynamically typed
- **No modules** - Everything's in one file
- **No let expressions** - Use `const` at the top level
- **No list comprehensions** - Use `map`, `filter`, and `fold`

## Architecture

Piper is implemented in TypeScript:

- **Lexer** (`src/lexer.ts`) - Tokenizes source code
- **Parser** (`src/parser.ts`) - Builds an AST with proper precedence
- **Interpreter** (`src/interpreter.ts`) - Tree-walking interpreter
- **Compiler** (`src/transpiler.ts`) - Converts to JavaScript
- **CLI** (`src/piper.ts`) - Command-line interface

## Implementation Notes

Both the interpreter and compiler support:

- Recursion (via environment placeholder trick)
- Closures (proper lexical scoping)
- Currying (all functions are unary)
- Higher-order functions
- Proper operator precedence

The compiler maps Piper's `=` to JavaScript's `===`.

## Contributing

I wouldn't. This isn't going anywhere. I hope you enjoyed it.

## License

MIT

## Credits

Inspired by the greats: SML, F#, Elixir, Haskell, Racket, Scheme, and Unix pipes.
