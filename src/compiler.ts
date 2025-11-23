// JavaScript Compiler for Piper Language

import * as AST from './ast.js';

export class Compiler {
  private indent: number = 0;
  private indentSize: number = 2;
  private varCounts: Map<string, number> = new Map();
  private currentNames: Map<string, string> = new Map();
  private tempVarCounter: number = 0;

  private getIndent(): string {
    return ' '.repeat(this.indent * this.indentSize);
  }

  private getTempVar(): string {
    return `__tmp${this.tempVarCounter++}`;
  }

  private getVarName(name: string): string {
    // Check if this variable has been shadowed
    const count = this.varCounts.get(name) || 0;
    if (count > 0) {
      return `${name}$${count}`;
    }
    return name;
  }

  private declareVar(name: string): string {
    // Increment shadow count for this variable
    const count = (this.varCounts.get(name) || 0) + 1;
    this.varCounts.set(name, count);

    // Calculate the actual JS variable name
    const jsName = count > 1 ? `${name}$${count}` : name;
    this.currentNames.set(name, jsName);
    return jsName;
  }

  private useVar(name: string): string {
    // Use the most recent version of this variable
    return this.currentNames.get(name) || name;
  }

  private isComplexExpr(expr: AST.Expr): boolean {
    // Check if an expression is complex enough to warrant caching
    switch (expr.type) {
      case 'Identifier':
      case 'IntLiteral':
      case 'FloatLiteral':
      case 'StringLiteral':
      case 'BoolLiteral':
      case 'UnitLiteral':
        return false;  // Simple expressions don't need caching
      default:
        return true;   // Complex expressions should be cached
    }
  }

  public compile(program: AST.Program): string {
    const parts: string[] = [];

    // Add runtime library
    parts.push(this.generateRuntime());
    parts.push('');

    // Compile declarations
    for (const decl of program.declarations) {
      const code = this.compileDeclaration(decl);
      if (code) {
        parts.push(code);
      }
    }

    return parts.join('\n');
  }

  private generateRuntime(): string {
    return `// Piper Runtime Library
const __piper__ = {
  // List operations
  head: (list) => {
    if (!Array.isArray(list)) throw new Error('head: argument must be a list');
    if (list.length === 0) throw new Error('head: list is empty');
    return list[0];
  },
  tail: (list) => {
    if (!Array.isArray(list)) throw new Error('tail: argument must be a list');
    if (list.length === 0) throw new Error('tail: list is empty');
    return list.slice(1);
  },
  cons: (list) => (elem) => {
    if (!Array.isArray(list)) throw new Error('cons: first argument must be a list');
    return [elem, ...list];
  },
  length: (list) => {
    if (!Array.isArray(list)) throw new Error('length: argument must be a list');
    return list.length;
  },

  // String and span operations
  concat: (arg2) => (arg1) => {
    // Handle strings
    if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      return arg1 + arg2;
    }
    // Handle spans (arrays)
    if (Array.isArray(arg1) && Array.isArray(arg2)) {
      return [...arg1, ...arg2];
    }
    throw new Error('concat: both arguments must be strings or both must be spans');
  },

  // Record and span operations
  get: (key) => (collection) => {
    // For records (objects): key must be string
    if (typeof collection === 'object' && collection !== null && !Array.isArray(collection)) {
      if (typeof key !== 'string') throw new Error('get: field name must be a string for records');
      if (!(key in collection))
        throw new Error(\`get: field '\${key}' not found in record\`);
      return collection[key];
    }
    // For spans (arrays): key must be integer
    if (Array.isArray(collection)) {
      if (typeof key !== 'number' || !Number.isInteger(key))
        throw new Error('get: index must be an integer for spans');
      if (key < 0 || key >= collection.length)
        throw new Error(\`get: index \${key} out of bounds (span length: \${collection.length})\`);
      return collection[key];
    }
    throw new Error('get: second argument must be a record or span');
  },
  set: (key) => (value) => (collection) => {
    // For records (objects): key must be string
    if (typeof collection === 'object' && collection !== null && !Array.isArray(collection)) {
      if (typeof key !== 'string') throw new Error('set: field name must be a string for records');
      // Mutate the record
      collection[key] = value;
      return collection;
    }
    // For spans (arrays): key must be integer
    if (Array.isArray(collection)) {
      if (typeof key !== 'number' || !Number.isInteger(key))
        throw new Error('set: index must be an integer for spans');
      if (key < 0 || key >= collection.length)
        throw new Error(\`set: index \${key} out of bounds (span length: \${collection.length})\`);
      // Mutate the span
      collection[key] = value;
      return collection;
    }
    throw new Error('set: third argument must be a record or span');
  },

  // Span-specific operations
  slice: (start) => (end) => (span) => {
    if (!Array.isArray(span)) throw new Error('slice: third argument must be a span');
    if (typeof start !== 'number' || !Number.isInteger(start))
      throw new Error('slice: start index must be an integer');
    if (typeof end !== 'number' || !Number.isInteger(end))
      throw new Error('slice: end index must be an integer');

    // Handle -1 as "length - 1" (excludes last element)
    let endIdx = end === -1 ? span.length - 1 : end;

    if (start < 0 || start > span.length)
      throw new Error(\`slice: start index \${start} out of bounds\`);
    if (endIdx < 0 || endIdx > span.length)
      throw new Error(\`slice: end index \${endIdx} out of bounds\`);
    if (start > endIdx)
      throw new Error(\`slice: start index \${start} cannot be greater than end index \${endIdx}\`);
    return span.slice(start, endIdx);
  },
  to_list: (span) => {
    if (!Array.isArray(span)) throw new Error('to_list: argument must be a span');
    return [...span];
  },
  to_span: (list) => {
    if (!Array.isArray(list)) throw new Error('to_span: argument must be a list');
    return [...list];
  },

  // Get/set last element (useful for stack operations)
  getLast: (span) => {
    if (!Array.isArray(span)) throw new Error('getLast: argument must be a span');
    if (span.length === 0) throw new Error('getLast: cannot get from empty span');
    return span[span.length - 1];
  },
  setLast: (value) => (span) => {
    if (!Array.isArray(span)) throw new Error('setLast: second argument must be a span');
    if (span.length === 0) throw new Error('setLast: cannot set on empty span');
    span[span.length - 1] = value;
    return span;
  },

  // Boolean operations
  and: (arg2) => (arg1) => {
    if (typeof arg1 !== 'boolean')
      throw new Error('and: first argument must be a boolean');
    if (typeof arg2 !== 'boolean')
      throw new Error('and: second argument must be a boolean');
    return arg1 && arg2;
  },
  or: (arg2) => (arg1) => {
    if (typeof arg1 !== 'boolean')
      throw new Error('or: first argument must be a boolean');
    if (typeof arg2 !== 'boolean')
      throw new Error('or: second argument must be a boolean');
    return arg1 || arg2;
  },

  // I/O
  print: (value) => {
    console.log(__piper__.show(value));
    return undefined; // Unit
  },
  show: (value) => {
    if (value === undefined) return '()';
    if (Array.isArray(value)) {
      return '[' + value.map(__piper__.show).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
      const fields = Object.entries(value)
        .map(([k, v]) => \`\${k}: \${__piper__.show(v)}\`)
        .join(', ');
      return '{' + fields + '}';
    }
    return String(value);
  },

  // Higher-order functions
  map: (f) => (list) => {
    if (!Array.isArray(list)) throw new Error('map: second argument must be a list');
    return list.map(f);
  },
  filter: (f) => (list) => {
    if (!Array.isArray(list)) throw new Error('filter: second argument must be a list');
    return list.filter(f);
  },
  fold: (init) => (f) => (list) => {
    if (!Array.isArray(list)) throw new Error('fold: third argument must be a list');
    return list.reduce((acc, elem) => f(acc)(elem), init);
  },
};

// Box operations (aliases for getLast/setLast)
__piper__.unbox = __piper__.getLast;
__piper__.box = __piper__.setLast;

// Export built-in functions to global scope
const { head, tail, cons, length, concat, get, set, slice, to_list, to_span, getLast, setLast, unbox, box, and, or, print, show, map, filter, fold } = __piper__;
`;
  }

  private compileDeclaration(decl: AST.Declaration): string {
    switch (decl.type) {
      case 'UseDecl':
        // For now, just comment it out
        return `// use "${decl.path}" (not implemented)`;

      case 'ConstDecl':
        const value = this.compileExpr(decl.value);
        const jsName = this.declareVar(decl.name);
        return `const ${jsName} = ${value};`;

      case 'TopLevelPipeline':
        const expr = this.compileExpr(decl.expr);
        return `${expr};`;
    }
  }

  private compileExpr(expr: AST.Expr, needsParens: boolean = false): string {
    let code = '';

    switch (expr.type) {
      case 'IntLiteral':
      case 'FloatLiteral':
        code = expr.value.toString();
        break;

      case 'StringLiteral':
        code = JSON.stringify(expr.value);
        break;

      case 'BoolLiteral':
        code = expr.value ? 'true' : 'false';
        break;

      case 'UnitLiteral':
        code = 'undefined';
        break;

      case 'ListLiteral':
        const elements = expr.elements.map((e) => this.compileExpr(e));
        code = `[${elements.join(', ')}]`;
        break;

      case 'SpanLiteral':
        const spanElements = expr.elements.map((e) => this.compileExpr(e));
        code = `[${spanElements.join(', ')}]`; // Spans are arrays in JS
        break;

      case 'RecordLiteral':
        const fields = expr.fields
          .map((f) => `${f.name}: ${this.compileExpr(f.value)}`)
          .join(', ');
        code = `{${fields}}`;
        break;

      case 'Identifier':
        code = this.useVar(expr.name);
        break;

      case 'Lambda':
        const body = this.compileExpr(expr.body);
        code = `(${expr.param}) => ${body}`;
        break;

      case 'Pipeline':
        // a |> b becomes b(a)
        const pipeLeft = this.compileExpr(expr.left);
        const pipeRight = this.compileExpr(expr.right);
        code = `${pipeRight}(${pipeLeft})`;
        break;

      case 'Stage':
        // Stage can be:
        // 1. Stage-args: H <| A1 ... An -> H(A1)(A2)...(An)
        // 2. Sub-pipeline: V <| T -> T(V)
        // We need runtime dispatch to handle both cases
        const stageFn = this.compileExpr(expr.fn);

        if (expr.args.length === 1) {
          // Single argument: could be either form
          // Check if we need to cache the function expression
          const needsCache = this.isComplexExpr(expr.fn);

          if (needsCache) {
            // Use IIFE to cache the function value
            const fnVar = this.getTempVar();
            const argCode = this.compileExpr(expr.args[0]);
            code = `((${fnVar}) => (typeof ${fnVar} === 'function' ? ${fnVar}(${argCode}) : ${argCode}(${fnVar})))(${stageFn})`;
          } else {
            // Simple expression, no need to cache
            const argCode = this.compileExpr(expr.args[0]);
            code = `(typeof ${stageFn} === 'function' ? ${stageFn}(${argCode}) : ${argCode}(${stageFn}))`;
          }
        } else {
          // Multiple arguments: must be stage-args
          let stageCode = stageFn;
          for (const arg of expr.args) {
            const argCode = this.compileExpr(arg);
            stageCode = `${stageCode}(${argCode})`;
          }
          code = stageCode;
        }
        break;

      case 'Conditional':
        const cond = this.compileExpr(expr.condition);
        const thenExpr = this.compileExpr(expr.thenBranch);
        const elseExpr = this.compileExpr(expr.elseBranch);
        code = `(${cond} ? ${thenExpr} : ${elseExpr})`;
        break;

      case 'Parens':
        code = `(${this.compileExpr(expr.expr)})`;
        break;

      case 'BinaryOp':
        const binLeft = this.compileExpr(expr.left);
        const binRight = this.compileExpr(expr.right);
        // Map Piper's = to JavaScript's ===
        const jsOp = expr.op === '=' ? '===' : expr.op;
        code = `(${binLeft} ${jsOp} ${binRight})`;
        break;

      case 'UnaryOp':
        const unaryOperand = this.compileExpr(expr.expr);
        code = `(${expr.op}${unaryOperand})`;
        break;
    }

    return needsParens ? `(${code})` : code;
  }
}
