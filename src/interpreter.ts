// Tree-walking Interpreter for Piper Language

import * as AST from './ast.js';

// Runtime values
export type RuntimeValue =
  | { type: 'int'; value: number }
  | { type: 'float'; value: number }
  | { type: 'string'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'unit' }
  | { type: 'list'; elements: RuntimeValue[] }
  | { type: 'span'; elements: RuntimeValue[] }
  | { type: 'record'; fields: Map<string, RuntimeValue> }
  | { type: 'function'; fn: (arg: RuntimeValue) => RuntimeValue }
  | { type: 'closure'; param: string; body: AST.Expr; env: Environment };

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeError';
  }
}

// Environment for variable bindings
export class Environment {
  private bindings: Map<string, RuntimeValue>;
  private parent: Environment | null;

  constructor(parent: Environment | null = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  define(name: string, value: RuntimeValue): void {
    this.bindings.set(name, value);
  }

  get(name: string): RuntimeValue {
    if (this.bindings.has(name)) {
      return this.bindings.get(name)!;
    }

    if (this.parent) {
      return this.parent.get(name);
    }

    throw new RuntimeError(`Undefined variable: ${name}`);
  }

  has(name: string): boolean {
    return this.bindings.has(name) || (this.parent?.has(name) ?? false);
  }
}

// Built-in functions
function createBuiltins(interpreter: Interpreter): Map<string, RuntimeValue> {
  const builtins = new Map<string, RuntimeValue>();


  // List operations
  builtins.set('head', {
    type: 'function',
    fn: (list) => {
      if (list.type !== 'list')
        throw new RuntimeError('head: argument must be a list');
      if (list.elements.length === 0)
        throw new RuntimeError('head: list is empty');
      return list.elements[0];
    },
  });

  builtins.set('tail', {
    type: 'function',
    fn: (list) => {
      if (list.type !== 'list')
        throw new RuntimeError('tail: argument must be a list');
      if (list.elements.length === 0)
        throw new RuntimeError('tail: list is empty');
      return { type: 'list', elements: list.elements.slice(1) };
    },
  });

  builtins.set('cons', {
    type: 'function',
    fn: (list) => ({
      type: 'function',
      fn: (elem) => {
        if (list.type !== 'list')
          throw new RuntimeError('cons: first argument must be a list');
        return { type: 'list', elements: [elem, ...list.elements] };
      },
    }),
  });

  builtins.set('length', {
    type: 'function',
    fn: (list) => {
      if (list.type !== 'list')
        throw new RuntimeError('length: argument must be a list');
      return { type: 'int', value: list.elements.length };
    },
  });

  // String and span operations
  builtins.set('concat', {
    type: 'function',
    fn: (arg2) => ({
      type: 'function',
      fn: (arg1) => {
        // Handle strings
        if (arg1.type === 'string' && arg2.type === 'string') {
          return { type: 'string', value: arg1.value + arg2.value };
        }

        // Handle spans
        if (arg1.type === 'span' && arg2.type === 'span') {
          return { type: 'span', elements: [...arg1.elements, ...arg2.elements] };
        }

        throw new RuntimeError('concat: both arguments must be strings or both must be spans');
      },
    }),
  });

  // Record and span operations
  builtins.set('get', {
    type: 'function',
    fn: (key) => ({
      type: 'function',
      fn: (collection) => {
        // For records: key must be string
        if (collection.type === 'record') {
          if (key.type !== 'string')
            throw new RuntimeError('get: field name must be a string for records');

          const field = collection.fields.get(key.value);
          if (field === undefined)
            throw new RuntimeError(`get: field '${key.value}' not found in record`);

          return field;
        }

        // For spans: key must be int
        if (collection.type === 'span') {
          if (key.type !== 'int')
            throw new RuntimeError('get: index must be an integer for spans');

          const index = key.value;
          if (index < 0 || index >= collection.elements.length)
            throw new RuntimeError(`get: index ${index} out of bounds (span length: ${collection.elements.length})`);

          return collection.elements[index];
        }

        throw new RuntimeError('get: second argument must be a record or span');
      },
    }),
  });

  builtins.set('set', {
    type: 'function',
    fn: (key) => ({
      type: 'function',
      fn: (value) => ({
        type: 'function',
        fn: (collection) => {
          // For records: key must be string
          if (collection.type === 'record') {
            if (key.type !== 'string')
              throw new RuntimeError('set: field name must be a string for records');

            // Mutate the record
            collection.fields.set(key.value, value);
            return collection;
          }

          // For spans: key must be int
          if (collection.type === 'span') {
            if (key.type !== 'int')
              throw new RuntimeError('set: index must be an integer for spans');

            const index = key.value;
            if (index < 0 || index >= collection.elements.length)
              throw new RuntimeError(`set: index ${index} out of bounds (span length: ${collection.elements.length})`);

            // Mutate the span
            collection.elements[index] = value;
            return collection;
          }

          throw new RuntimeError('set: third argument must be a record or span');
        },
      }),
    }),
  });

  // Span-specific operations
  builtins.set('slice', {
    type: 'function',
    fn: (start) => ({
      type: 'function',
      fn: (end) => ({
        type: 'function',
        fn: (span) => {
          if (span.type !== 'span')
            throw new RuntimeError('slice: third argument must be a span');
          if (start.type !== 'int')
            throw new RuntimeError('slice: start index must be an integer');
          if (end.type !== 'int')
            throw new RuntimeError('slice: end index must be an integer');

          let startIdx = start.value;
          let endIdx = end.value;

          // Handle -1 as "length - 1" (excludes last element)
          if (endIdx === -1) {
            endIdx = span.elements.length - 1;
          }

          if (startIdx < 0 || startIdx > span.elements.length)
            throw new RuntimeError(`slice: start index ${startIdx} out of bounds`);
          if (endIdx < 0 || endIdx > span.elements.length)
            throw new RuntimeError(`slice: end index ${endIdx} out of bounds`);
          if (startIdx > endIdx)
            throw new RuntimeError(`slice: start index ${startIdx} cannot be greater than end index ${endIdx}`);

          // Return a new span (slice is not mutating)
          return { type: 'span', elements: span.elements.slice(startIdx, endIdx) };
        },
      }),
    }),
  });

  builtins.set('to_list', {
    type: 'function',
    fn: (span) => {
      if (span.type !== 'span')
        throw new RuntimeError('to_list: argument must be a span');

      // Convert span to list (creates new list)
      return { type: 'list', elements: [...span.elements] };
    },
  });

  builtins.set('to_span', {
    type: 'function',
    fn: (list) => {
      if (list.type !== 'list')
        throw new RuntimeError('to_span: argument must be a list');

      // Convert list to span (creates new span)
      return { type: 'span', elements: [...list.elements] };
    },
  });

  // Get/set last element (useful for stack operations)
  builtins.set('getLast', {
    type: 'function',
    fn: (span) => {
      if (span.type !== 'span')
        throw new RuntimeError('getLast: argument must be a span');

      if (span.elements.length === 0)
        throw new RuntimeError('getLast: cannot get from empty span');

      return span.elements[span.elements.length - 1];
    },
  });

  builtins.set('setLast', {
    type: 'function',
    fn: (value) => ({
      type: 'function',
      fn: (span) => {
        if (span.type !== 'span')
          throw new RuntimeError('setLast: second argument must be a span');

        if (span.elements.length === 0)
          throw new RuntimeError('setLast: cannot set on empty span');

        // Mutate the span (set last element)
        span.elements[span.elements.length - 1] = value;
        return span;
      },
    }),
  });

  // Box operations (aliases for getLast/setLast with their own error messages)
  builtins.set('unbox', {
    type: 'function',
    fn: (span) => {
      if (span.type !== 'span')
        throw new RuntimeError('unbox: argument must be a span');

      if (span.elements.length === 0)
        throw new RuntimeError('unbox: cannot unbox from empty span');

      return span.elements[span.elements.length - 1];
    },
  });

  builtins.set('box', {
    type: 'function',
    fn: (value) => ({
      type: 'function',
      fn: (span) => {
        if (span.type !== 'span')
          throw new RuntimeError('box: second argument must be a span');

        if (span.elements.length === 0)
          throw new RuntimeError('box: cannot box to empty span');

        // Mutate the span (set last element)
        span.elements[span.elements.length - 1] = value;
        return span;
      },
    }),
  });

  // Boolean operations
  builtins.set('and', {
    type: 'function',
    fn: (arg2) => ({
      type: 'function',
      fn: (arg1) => {
        if (arg1.type !== 'bool')
          throw new RuntimeError('and: first argument must be a boolean');
        if (arg2.type !== 'bool')
          throw new RuntimeError('and: second argument must be a boolean');
        return { type: 'bool', value: arg1.value && arg2.value };
      },
    }),
  });

  builtins.set('or', {
    type: 'function',
    fn: (arg2) => ({
      type: 'function',
      fn: (arg1) => {
        if (arg1.type !== 'bool')
          throw new RuntimeError('or: first argument must be a boolean');
        if (arg2.type !== 'bool')
          throw new RuntimeError('or: second argument must be a boolean');
        return { type: 'bool', value: arg1.value || arg2.value };
      },
    }),
  });

  // I/O
  builtins.set('print', {
    type: 'function',
    fn: (value) => {
      console.log(valueToString(value));
      return { type: 'unit' };
    },
  });

  builtins.set('show', {
    type: 'function',
    fn: (value) => {
      return { type: 'string', value: valueToString(value) };
    },
  });

  // Higher-order functions
  builtins.set('map', {
    type: 'function',
    fn: (f) => ({
      type: 'function',
      fn: (list) => {
        if (list.type !== 'list')
          throw new RuntimeError('map: second argument must be a list');
        if (f.type !== 'function' && f.type !== 'closure')
          throw new RuntimeError('map: first argument must be a function');

        const mapped = list.elements.map((elem) => {
          if (f.type === 'function') {
            return f.fn(elem);
          } else {
            // f is a closure - use interpreter's applyFunction
            return interpreter.applyFunction(f, elem, f.env);
          }
        });

        return { type: 'list', elements: mapped };
      },
    }),
  });

  builtins.set('filter', {
    type: 'function',
    fn: (f) => ({
      type: 'function',
      fn: (list) => {
        if (list.type !== 'list')
          throw new RuntimeError('filter: second argument must be a list');
        if (f.type !== 'function' && f.type !== 'closure')
          throw new RuntimeError('filter: first argument must be a function');

        const filtered = list.elements.filter((elem) => {
          let result: RuntimeValue;
          if (f.type === 'function') {
            result = f.fn(elem);
          } else {
            // f is a closure - use interpreter's applyFunction
            result = interpreter.applyFunction(f, elem, f.env);
          }

          if (result.type !== 'bool')
            throw new RuntimeError('filter predicate must return a boolean');
          return result.value;
        });

        return { type: 'list', elements: filtered };
      },
    }),
  });

  builtins.set('fold', {
    type: 'function',
    fn: (init) => ({
      type: 'function',
      fn: (f) => ({
        type: 'function',
        fn: (list) => {
          if (list.type !== 'list')
            throw new RuntimeError('fold: third argument must be a list');
          if (f.type !== 'function' && f.type !== 'closure')
            throw new RuntimeError('fold: second argument must be a function');

          let acc = init;
          for (const elem of list.elements) {
            // Apply f to acc, then to elem
            let fAcc: RuntimeValue;
            if (f.type === 'function') {
              fAcc = f.fn(acc);
            } else {
              // f is a closure - use interpreter's applyFunction
              fAcc = interpreter.applyFunction(f, acc, f.env);
            }

            if (fAcc.type !== 'function' && fAcc.type !== 'closure')
              throw new RuntimeError('fold function must be curried');

            if (fAcc.type === 'function') {
              acc = fAcc.fn(elem);
            } else {
              // fAcc is a closure - use interpreter's applyFunction
              acc = interpreter.applyFunction(fAcc, elem, fAcc.env);
            }
          }

          return acc;
        },
      }),
    }),
  });

  return builtins;
}

function valuesEqual(a: RuntimeValue, b: RuntimeValue): boolean {
  // Allow numeric comparisons between int and float
  if ((a.type === 'int' || a.type === 'float') && (b.type === 'int' || b.type === 'float')) {
    return a.value === (b as any).value;
  }

  // For non-numeric types, require exact type match
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'string':
    case 'bool':
      return a.value === (b as any).value;
    case 'unit':
      return true;
    case 'list':
    case 'span':
      const bList = b as typeof a;
      if (a.elements.length !== bList.elements.length) return false;
      return a.elements.every((elem, i) => valuesEqual(elem, bList.elements[i]));
    default:
      return false;
  }
}

function valueToString(value: RuntimeValue): string {
  switch (value.type) {
    case 'int':
    case 'float':
      return value.value.toString();
    case 'string':
      return value.value;
    case 'bool':
      return value.value ? 'true' : 'false';
    case 'unit':
      return '()';
    case 'list':
      return '[' + value.elements.map(valueToString).join(', ') + ']';
    case 'span':
      return '#[' + value.elements.map(valueToString).join(', ') + ']';
    case 'record':
      const fields = Array.from(value.fields.entries())
        .map(([k, v]) => `${k}: ${valueToString(v)}`)
        .join(', ');
      return '{' + fields + '}';
    case 'function':
      return '<function>';
    case 'closure':
      return `<closure \\${value.param} -> ...>`;
  }
}

export class Interpreter {
  private globalEnv: Environment;

  constructor() {
    this.globalEnv = new Environment();

    // Add built-in functions
    const builtins = this.createBuiltins();
    for (const [name, value] of builtins) {
      this.globalEnv.define(name, value);
    }
  }

  private createBuiltins(): Map<string, RuntimeValue> {
    return createBuiltins(this);
  }

  public run(program: AST.Program): RuntimeValue {
    let lastValue: RuntimeValue = { type: 'unit' };
    let currentEnv = this.globalEnv;

    for (const decl of program.declarations) {
      const result = this.evalDeclaration(decl, currentEnv);
      lastValue = result.value;
      currentEnv = result.env;
    }

    return lastValue;
  }

  private evalDeclaration(
    decl: AST.Declaration,
    env: Environment
  ): { value: RuntimeValue; env: Environment } {
    switch (decl.type) {
      case 'UseDecl':
        throw new RuntimeError('use declarations are not yet implemented');

      case 'ConstDecl':
        // Create a new environment layer for this binding
        // This enables proper shadowing where closures capture their lexical environment
        const newEnv = new Environment(env);

        // For recursion support: define name first with a placeholder,
        // then evaluate the value (which can reference the name),
        // then update with the actual value
        newEnv.define(decl.name, { type: 'unit' }); // Placeholder
        const value = this.evalExpr(decl.value, newEnv);
        newEnv.define(decl.name, value); // Update with actual value

        return { value: { type: 'unit' }, env: newEnv };

      case 'TopLevelPipeline':
        return { value: this.evalExpr(decl.expr, env), env };
    }
  }

  private evalExpr(expr: AST.Expr, env: Environment): RuntimeValue {
    switch (expr.type) {
      case 'IntLiteral':
        return { type: 'int', value: expr.value };

      case 'FloatLiteral':
        return { type: 'float', value: expr.value };

      case 'StringLiteral':
        return { type: 'string', value: expr.value };

      case 'BoolLiteral':
        return { type: 'bool', value: expr.value };

      case 'UnitLiteral':
        return { type: 'unit' };

      case 'ListLiteral':
        const elements = expr.elements.map((e) => this.evalExpr(e, env));
        return { type: 'list', elements };

      case 'SpanLiteral':
        const spanElements = expr.elements.map((e) => this.evalExpr(e, env));
        return { type: 'span', elements: spanElements };

      case 'RecordLiteral':
        const fields = new Map<string, RuntimeValue>();
        for (const field of expr.fields) {
          fields.set(field.name, this.evalExpr(field.value, env));
        }
        return { type: 'record', fields };

      case 'Identifier':
        return env.get(expr.name);

      case 'Lambda':
        return {
          type: 'closure',
          param: expr.param,
          body: expr.body,
          env,
        };

      case 'Pipeline':
        const leftVal = this.evalExpr(expr.left, env);
        const rightVal = this.evalExpr(expr.right, env);
        return this.applyFunction(rightVal, leftVal, env);

      case 'Stage':
        // Stage can be:
        // 1. Stage-args: H <| A1 ... An where H is a function
        //    Returns: λ v. (((h a1) a2) ... an) v
        // 2. Sub-pipeline: V <| T where V is a value and T is a stage
        //    Returns: λ w. g(w) where g = T(V)
        const fnVal = this.evalExpr(expr.fn, env);
        const argVals = expr.args.map((arg) => this.evalExpr(arg, env));

        // Determine if this is stage-args or sub-pipeline
        if (fnVal.type === 'function' || fnVal.type === 'closure') {
          // Stage-args: H <| A1 ... An
          return {
            type: 'function',
            fn: (pipedValue: RuntimeValue) => {
              // Apply fnVal to each arg in sequence
              let result: RuntimeValue = fnVal;
              for (const argVal of argVals) {
                result = this.applyFunction(result, argVal, env);
              }
              // Then apply to the piped value
              return this.applyFunction(result, pipedValue, env);
            },
          };
        } else {
          // Sub-pipeline: V <| T
          // V = fnVal (a value)
          // T = argVals[0] (should be a function)
          if (argVals.length !== 1) {
            throw new RuntimeError('Sub-pipeline form expects exactly one stage on RHS');
          }
          const stageFunc = argVals[0];
          if (stageFunc.type !== 'function' && stageFunc.type !== 'closure') {
            throw new RuntimeError('Sub-pipeline RHS must be a function');
          }
          // Apply stageFunc to fnVal to get g
          const g = this.applyFunction(stageFunc, fnVal, env);
          if (g.type !== 'function' && g.type !== 'closure') {
            throw new RuntimeError('Sub-pipeline result must be a function');
          }
          // Return λ w. g(w)
          return g;
        }

      case 'Conditional':
        const condVal = this.evalExpr(expr.condition, env);
        if (condVal.type !== 'bool') {
          throw new RuntimeError('Condition must be a boolean');
        }
        return condVal.value
          ? this.evalExpr(expr.thenBranch, env)
          : this.evalExpr(expr.elseBranch, env);

      case 'Parens':
        return this.evalExpr(expr.expr, env);

      case 'BinaryOp': {
        const left = this.evalExpr(expr.left, env);
        const right = this.evalExpr(expr.right, env);

        // Equality operator works on all types
        if (expr.op === '=') {
          return { type: 'bool', value: valuesEqual(left, right) };
        }

        // Type check: both operands must be numbers for other operators
        if ((left.type !== 'int' && left.type !== 'float') ||
            (right.type !== 'int' && right.type !== 'float')) {
          throw new RuntimeError(`Cannot apply operator '${expr.op}' to non-numeric values`);
        }

        // Comparison operators return boolean
        if (expr.op === '>' || expr.op === '<') {
          let boolResult: boolean;
          switch (expr.op) {
            case '>':
              boolResult = left.value > right.value;
              break;
            case '<':
              boolResult = left.value < right.value;
              break;
          }
          return { type: 'bool', value: boolResult };
        }

        // Arithmetic operators return number
        let result: number;
        switch (expr.op) {
          case '+':
            result = left.value + right.value;
            break;
          case '-':
            result = left.value - right.value;
            break;
          case '*':
            result = left.value * right.value;
            break;
          case '/':
            if (right.value === 0) {
              throw new RuntimeError('Division by zero');
            }
            result = left.value / right.value;
            break;
          case '%':
            if (right.value === 0) {
              throw new RuntimeError('Modulo by zero');
            }
            result = left.value % right.value;
            break;
          case '**':
            result = Math.pow(left.value, right.value);
            break;
        }

        // Return float if either operand is float, or if it's division or exponentiation
        if (left.type === 'float' || right.type === 'float' || expr.op === '/' || expr.op === '**') {
          return { type: 'float', value: result };
        } else {
          return { type: 'int', value: result };
        }
      }

      case 'UnaryOp': {
        const operand = this.evalExpr(expr.expr, env);

        // Currently only '-' is supported
        if (operand.type !== 'int' && operand.type !== 'float') {
          throw new RuntimeError('Unary minus can only be applied to numbers');
        }
        return operand.type === 'int'
          ? { type: 'int', value: -operand.value }
          : { type: 'float', value: -operand.value };
      }
    }
  }

  public applyFunction(
    fn: RuntimeValue,
    arg: RuntimeValue,
    env: Environment
  ): RuntimeValue {
    if (fn.type === 'function') {
      return fn.fn(arg);
    }

    if (fn.type === 'closure') {
      const newEnv = new Environment(fn.env);
      newEnv.define(fn.param, arg);
      return this.evalExpr(fn.body, newEnv);
    }

    throw new RuntimeError(
      `Cannot apply non-function value: ${valueToString(fn)}`
    );
  }

  public getGlobalEnv(): Environment {
    return this.globalEnv;
  }
}
