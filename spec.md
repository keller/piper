# Piper Language Specification (v0.1)

This document defines the Piper programming language precisely enough for an implementer to build a parser and interpreter. Piper is intentionally small and opinionated, featuring unary functions, pipeline-oriented syntax, and support for recursion.

## 1. Design goals (non-normative)

- **Unary functions only.** All functions take exactly one parameter. "Multiple arguments" are modeled via currying.

- **Pipe-only calls.** Function invocation is only allowed through a pipeline operator, never by juxtaposition or parentheses.

- **Right-hand is a function.** In any `lhs |> rhs`, the RHS must evaluate to a function; the LHS is the value given to it.

- **Recursion support.** Functions can reference themselves in their definitions, enabling recursive algorithms like factorial and fibonacci.

- **Stage sugar.** The operator `<|` supports (a) passing fixed arguments to a stage, and (b) building sub-pipelines without parentheses.

- **Tiny entrypoint sugar.** At top level only, a pipeline may omit its left-hand expression; it implicitly uses the Unit value `()`.

## 2. Lexical structure

### 2.1 Character set

- Source is UTF-8.

- Identifiers may contain Unicode letters, digits, `_`, and `'`, but must start with a letter or `_`.

### 2.2 Whitespace and comments

- Whitespace separates tokens and has no semantic meaning.

- Line comments start with `--` and run to end of line.

- Block comments: `{- … -}` (nesting allowed).

### 2.3 Tokens

**Keywords:** `use`, `true`, `false`, `if`, `then`, `else`, `const`

**Literals:**

- Integer: `0`, `42`
- Float: `3.14`, `0.001`
- Negative numbers: formed with unary minus operator: `-7`, `-3.14`
- String: `"..."` (basic escapes: `\"` `\\` `\n` `\t`)
- Boolean: `true`, `false`
- Unit: `()`
- List: `[e1 e2 ...]`
- Span: `#[e1 e2 ...]`
- Record: `{name = "keller" age = 42}`

**Operators / punctuation:**

- Pipe: `|>` (and alias `|`)
- Stage: `<|`
- Lambda: `\ … ->`
- Arithmetic: `+`, `-`, `*`, `/`, `%`, `**`
- Comparison: `=`, `>`, `<`
- Parens: `(` `)`
- Brackets: `[` `]`
- Braces: `{` `}`
- Hash: `#` (for Span literals)
- Comma: `,` (not used in current syntax)
- Assignment in records: `=`

**Identifiers:** `/[A-Za-z\_][\w']\*/`

## 3. Grammar (EBNF)

The grammar below is surface Piper; §8 defines desugaring into a small core.

```
program       ::= toplevel_item*

toplevel_item ::= const_decl
                | top_pipeline

const_decl    ::= "const" IDENT "=" expr

top_pipeline  ::= pipe_lead stage (pipe_op stage)*   // leading pipe sugar

expr          ::= pipeline

pipeline      ::= stage (pipe_op stage)*
pipe_op       ::= "|>" | "|"

stage         ::= stage_head
                | stage_head "<|" stage_args         // stage-args form
                | stage_seed  "<|" stage_tail        // sub-pipeline form

stage_head    ::= conditional                        // must evaluate to a function
stage_args    ::= conditional+                       // one or more expressions
stage_seed    ::= conditional                        // value that begins sub-pipeline
stage_tail    ::= stage                              // a (possibly compound) stage

conditional   ::= "if" expr "then" expr "else" expr | lambda
lambda        ::= "\" IDENT "->" expr | comparison
comparison    ::= additive (("="|">"|"<") additive)*
additive      ::= multiplicative (("+"|"-") multiplicative)*
multiplicative::= exponentiation (("*"|"/"|"%") exponentiation)*
exponentiation::= unary ("**" exponentiation)?           // right-associative
unary         ::= "-" unary | primary

primary       ::= literal
                | IDENT
                | list_lit
                | Span_lit
                | record_lit
                | "(" expr ")"

literal       ::= NUMBER | STRING | "true" | "false" | unit_lit
unit_lit      ::= "(" ")"     // Unit value
list_lit      ::= "[" expr* "]"
Span_lit    ::= "#[" expr* "]"
record_lit    ::= "{" (IDENT "=" expr)* "}"

pipe_lead     ::= "|>" | "|"  // top-level only
```

**Notes**

- There is no general function application in `application`: juxtaposition like `f x` is a parse error. Functions are invoked only via pipelines.

- `stage` admits three syntactic categories (simple, stage-args, and sub-pipeline).

- A `top_pipeline` is only valid at the top level of a file.

## 4. Operator precedence & associativity

From tightest (higher precedence) to loosest:

1. **Parentheses, literals, identifiers, list/record literals**

2. **Unary operators (`-`) — right-associative**

3. **Exponentiation (`**`) — right-associative**
   - `2 ** 3 ** 4` parses as `2 ** (3 ** 4)`

4. **Multiplicative (`*`, `/`, `%`) — left-associative**

5. **Additive (`+`, `-`) — left-associative**

6. **Comparison (`=`, `>`, `<`) — left-associative**

7. **Lambda (`\` ... `->`) — right-associative**

8. **Conditional (`if`-`then`-`else`)**

9. **`<|` (stage constructor) — right-associative**
   - Binds tighter than `|>`/`|`
   - `a <| f <| x y` parses as `a <| (f <| x y)`

10. **`|>` and `|` (pipe) — left-associative**

**Examples:**

- `x |> f |> g` parses as `(x |> f) |> g`.

- `x |> 10 <| add` parses as `x |> (10 <| add)` because `<|` binds tighter than pipe.

## 5. Type system

Piper is dynamically typed. Type checking is performed at runtime.

## 6. Dynamic semantics (evaluation)

### 6.1 Values

Numbers (int or float), strings, booleans, unit `()`, lists, Spans, records, and functions (closures) are values.

### 6.2 Evaluation strategy

- Call-by-value (eager). Left-to-right evaluation inside expressions.

- Lambda bodies evaluated when applied.

### 6.3 Pipe evaluation

Given `E |> S`:

1. Evaluate `E` to value `v`.

2. Evaluate `S` to value `f`.

3. Runtime check: if `f` is not a function, raise `PipeTargetNotFunction`.

4. Result is application `f(v)` (i.e., invoke function with `v`).

**Chaining:** `E0 |> S1 |> S2 ...` is left-associated; feed each result to the next stage.

### 6.4 Stage forms (runtime meaning)

Let ⟦…⟧ denote evaluation.

**Simple stage** `S ≡ H`

Evaluate `H`:

- `f = ⟦H⟧`, must be a function.

**Stage-args** `S ≡ H <| A1 ... An`

- Evaluate `h = ⟦H⟧`, each `ai = ⟦Ai⟧`.

- Build a unary function:

```
f = (λ v. (((h a1) a2) ... an) v)
```

(conceptual; actual application is deferred to the enclosing pipe).

**Sub-pipeline** `S ≡ V <| T`

- Evaluate `v = ⟦V⟧`.

- Evaluate stage `T` to a function `t` (using these same rules).

- Compute `g = t(v)`; must be a function (or you error later when used).

- Return a unary function:

```
f = (λ w. g(w))
```

In both (2) and (3), the result of evaluating a stage is always a unary function suitable as the RHS of a pipe.

### 6.5 Lambda

`\x -> body` evaluates to a closure capturing its environment.

Application applies closure with argument binding `x := value` and evaluates the body.

### 6.6 Const declarations and recursion

`const name = expr` evaluates `expr` and binds it to `name` in the environment.

**Recursion:** Implementations should support recursive definitions, where the name being defined can appear in its own definition. This is typically implemented by binding the name to a placeholder value before evaluating the expression, then updating the binding with the actual value. This allows lambda expressions to reference their own name.

Example:
```piper
const factorial = \n ->
  if n = 0
  then 1
  else n * (n - 1 |> factorial)
```

### 6.7 Conditionals (if/then/else)

Evaluate condition to a boolean; pick branch; evaluate branch result.

### 6.8 Binary operators

**Arithmetic operators** (`+`, `-`, `*`, `/`, `%`, `**`): Require numeric operands (int or float). Division (`/`) and exponentiation (`**`) always return float.

**Comparison operators:**
- `>`, `<`: Require numeric operands, return boolean
- `=`: Works on all types (numbers, strings, booleans, unit, lists, Spans), returns boolean. Uses deep equality for lists and Spans. Numbers can be compared across int/float types (e.g., `5 = 5.0` is true).

### 6.9 Collections

**Lists** are immutable sequences. Constructed eagerly.

**Spans** are mutable sequences with indexed access. Created with `#[...]` syntax.

**Records** are mutable key-value maps. Created with `{key = value ...}` syntax.

Library functions (`map`, `filter`, `fold`, etc.) operate on lists only and are ordinary curried functions.

## 7. Entry point and the Unit special case

### 7.1 Unit

Literal `()` is the unique inhabitant of type `Unit`.

A "no-argument function" is written as `const main = \u -> ...` and has type `Unit -> α`.

### 7.2 Top-level leading pipe sugar

At file top level only:

```
|> S1 |> S2 |> ... |> Sn
```

desugars to:

```
() |> S1 |> S2 |> ... |> Sn
```

Parsing rule: `top_pipeline ::= pipe_lead stage (pipe_op stage)*`

Not allowed inside expressions (no "empty LHS" except at top level).

## 8. Desugaring to a minimal core

Define a core language that allows ordinary curried application `F A` and `let` (or implicit substitution), with the same values/lambdas/if/lists, and primitive binary/unary operations.

Desugar surface Piper:

**Binary operators:**

`E1 + E2 ⇒ BinOp(+, E1, E2)` (similarly for `-`, `*`, `/`, `%`, `**`, `=`, `>`, `<`)

**Unary operators:**

`-E ⇒ UnaryOp(-, E)`

**Pipe:**

`E |> S ⇒ (SF) E` where `S ⇒ SF` (stage desugars to a unary function).

**Stage to unary function:**

- **Simple:** `H ⇒ H` (must denote function at runtime)

- **Stage-args:** `H <| A1 ... An ⇒ (\v -> (((H A1) A2) ... An) v)`

- **Sub-pipeline:** `V <| T ⇒ (\v -> ( (T') V ) v)` where `T ⇒ T'` (and `T'` is a unary function)

**Top-level leading pipe:**

`|> S1 |> ... |> Sn ⇒ () |> S1 |> ... |> Sn` then apply (1).

**Implementer tip:** You can avoid a distinct desugaring pass by constructing the same AST forms directly during parsing.

## 9. Errors and diagnostics

At a minimum, the runtime must detect:

- **PipeTargetNotFunction:** RHS of `|>` did not evaluate to a function.

- **StageArgEvaluationError:** any `A1 ... An` or `V` inside a stage failed to evaluate.

- **Arity misuse:** invoking a non-function value, or a curried chain that doesn't resolve to a function.

- **TopLevelEmptyPipeMisuse:** leading `|>` used inside an expression or not at top level.

- **TypeError:** arithmetic/comparison operators applied to non-numeric values.

- **DivisionByZero:** division or modulo operator with zero divisor.

## 10. Standard library

Built-in functions provided as ordinary curried functions:

- `print : String -> Unit` (or polymorphic `a -> Unit` via toString)

- `show : A -> String` (convert any value to string)

- `map : (A -> B) -> List<A> -> List<B>`

- `filter: (A -> Bool) -> List<A> -> List<A>`

- `fold : B -> ((B -> (A -> B))) -> List<A> -> B` (i.e., `fold init f xs`, with `f` curried as `\acc -> \x -> ...`)

- `length: List<A> -> Number`

- `head: List<A> -> A`

- `tail: List<A> -> List<A>`

- `cons: List<A> -> (A -> List<A>)`

- `to_span: List<A> -> Span` (convert list to Span)

- `concat: (String | Span) -> ((String | Span) -> (String | Span))` (concatenate two strings or two Spans)

- `get: (String | Int) -> ((Record | Span) -> A)` (access a field from a record or element from a Span)

- `set: (String | Int) -> (A -> ((Record | Span) -> (Record | Span)))` (update a field in a record or element in a Span; mutates the collection)

- `slice: Int -> (Int -> (Span -> Span))` (extract subSpan; returns new Span; end index of -1 excludes last element)

- `to_list: Span -> List<A>` (convert Span to list)

- `getLast: Span -> A` (read last element from Span; useful for stack operations)

- `setLast: A -> (Span -> Span)` (write to last element of Span; mutates the Span; useful for stack operations)

- `unbox: Span -> A` (alias for getLast; convenience for boxes)

- `box: A -> (Span -> Span)` (alias for setLast; convenience for boxes)

- `and: Bool -> (Bool -> Bool)` (logical AND; both arguments must be booleans)

- `or: Bool -> (Bool -> Bool)` (logical OR; both arguments must be booleans)

Arithmetic and comparison are provided via built-in operators:
- Arithmetic: `+`, `-`, `*`, `/`, `%`, `**`
- Comparison: `=`, `>`, `<`

Usage pattern (stage-args with space-separated arguments):

```
[12345]
  |> filter <| (\n -> n > 2)
  |> map    <| (\n -> n * n)
  |> fold   <| 0 (\acc -> \n -> acc + n)
  |> print

```

**Note:** Multiple arguments to a curried function are **space-separated** after `<|`, not chained with additional `<|` operators. For example:
- `fold <| 0 fn` (correct - space-separated)
- `fold <| 0 <| fn` (incorrect - creates nested stages due to right-associativity)

## 11. Conformance examples

### 11.1 Valid

```
const inc = \x -> x + 1
const double = \x -> x * 2

5 |> inc                    -- 6
3 + 5                       -- 8
2 * 3 + 4                   -- 10 (multiplication has higher precedence)
10 % 3                      -- 1 (modulo)
2 ** 3                      -- 8 (exponentiation)
2 ** 3 ** 2                 -- 512 (right-associative: 2 ** (3 ** 2))
3 * 2 ** 4                  -- 48 (exponentiation has higher precedence)
5 = 5                       -- true (equality)
10 > 5                      -- true (comparison)

const add10 = \x -> x + 10
[123] |> map <| add10     -- [11 12 13]

-- Recursion is supported
const factorial = \n ->
  if n = 0
  then 1
  else n * (n - 1 |> factorial)

5 |> factorial              -- 120

const main = \u ->
  "hi" |> print

|> main                     -- top-level sugar for () |> main
```

### 11.2 Invalid

```
inc 5                       -- ERROR: no direct application
5 |> 10                     -- ERROR: RHS is not a function
nums |> filter (\n -> ...)  -- ERROR: missing <|
x + (|> main)               -- ERROR: top-level empty pipe used in expression
```

## 12. Reference interpreter sketch (informative)

**AST essentials**

```
Expr = Lit | Var | Lambda(name, body) | Pipe(lhs, stage)
     | BinaryOp(op, left, right) | UnaryOp(op, expr)
     | Conditional(cond, then, else)
     | StageSimple(expr) | StageArgs(head, args[]) | StageSub(seed, tail)

Value = Num | Str | Bool | Unit | List<Value> | Closure(env, param, body)
```

**Eval rule (core)**

```
eval(expr, env):
  case BinaryOp(op, left, right):
    l = eval(left, env)
    r = eval(right, env)
    require Num(l) and Num(r)
    if (op == '/' or op == '%') and r == 0: error "Division by zero"
    if op in ['=' '>' '<']: return Bool(applyCompOp(op, l, r))
    return applyBinOp(op, l, r)  // arithmetic operators

  case UnaryOp(op, e):
    v = eval(e, env)
    require Num(v)
    return -v

  case Pipe(e, s):
    v = eval(e, env)
    f = evalStageToFunction(s, env)     // must yield a Closure
    return apply(f, v)

evalStageToFunction(s, env):
  switch s:
    StageSimple(h):
      f = eval(h, env)
      require function(f)
      return f
    StageArgs(h, args):
      hf = eval(h, env)
      argvals = [eval(a env) for a in args]
      return Closure(env={}, param="v",
                     body=Apply(ApplyChain(hf, argvals), Var("v")))
    StageSub(seed, tail):
      seedv = eval(seed, env)
      tf = evalStageToFunction(tail, env)    // must be function
      // (seed |> tail) = apply(tf, seedv) ; must return a function
      g = apply(tf, seedv)
      require function(g)
      return g
```

**Top-level empty pipe**

Parser emits `TopPipeline([stage1 ... stageN])`

Desugar to `Pipe(UnitLit, stage1) |> ...` or construct AST directly.

## 13. Implementation notes

- **Parser:** enforce that in pipeline, the RHS tokens must parse as a `stage`; do not allow a general `expr` there.

- **Precedence:** Ensure `<|` binds tighter than `|>` so `x |> 10 <| add` parses as intended.

- **RHS invariant:** Both parser and type checker can help users by restricting RHS forms to `stage`. The interpreter still checks at runtime.

- **Lambdas:** Support nested currying via `\a -> \b -> body`.

- **Strings/IO:** You can start with a simple `print : a -> Unit` that calls the host's stdout, using toString on non-strings.

- **Records:** Implemented as runtime maps with field access via `get` and `set` library functions.

## 14. License & versioning

This spec is versioned; implementations should report conformance to Piper v0.1.

Deviations should be feature-flagged or documented.
