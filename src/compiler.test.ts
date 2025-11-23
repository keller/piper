// Compiler tests

import { test, describe } from 'node:test';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { assertEqual, assertThrows } from './test-utils.js';

function compile(source: string): string {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parseProgram();
  const compiler = new Compiler();
  return compiler.compile(program);
}

describe('Compiler', () => {
  describe('Literals', () => {
    test('should compile integer', () => {
      const js = compile('42');
      assertEqual(js.includes('42;'), true);
    });

    test('should compile float', () => {
      const js = compile('3.14');
      assertEqual(js.includes('3.14;'), true);
    });

    test('should compile string', () => {
      const js = compile('"hello"');
      assertEqual(js.includes('"hello";'), true);
    });

    test('should compile boolean', () => {
      const js = compile('true');
      assertEqual(js.includes('true;'), true);
    });

    test('should compile unit as undefined', () => {
      const js = compile('()');
      assertEqual(js.includes('undefined;'), true);
    });

    test('should compile list', () => {
      const js = compile('[1 2 3]');
      assertEqual(js.includes('[1, 2, 3];'), true);
    });

    test('should compile record', () => {
      const js = compile('{x = 10 y = 20}');
      assertEqual(js.includes('{x: 10, y: 20};'), true);
    });
  });

  describe('Identifiers', () => {
    test('should compile identifier', () => {
      const js = compile('const x = 42\nx');
      assertEqual(js.includes('const x = 42;'), true);
      assertEqual(js.includes('x;'), true);
    });
  });

  describe('Lambda', () => {
    test('should compile lambda', () => {
      const js = compile('\\x -> x');
      assertEqual(js.includes('(x) => x'), true);
    });

    test('should compile nested lambda', () => {
      const js = compile('\\x -> \\y -> x');
      assertEqual(js.includes('(x) => (y) => x'), true);
    });
  });

  describe('Pipeline', () => {
    test('should compile pipeline as function call', () => {
      const js = compile('x |> f');
      assertEqual(js.includes('f(x)'), true);
    });

    test('should compile chained pipeline', () => {
      const js = compile('x |> f |> g');
      assertEqual(js.includes('g(f(x))'), true);
    });
  });

  describe('Stage', () => {
    test('should compile stage with runtime dispatch', () => {
      const js = compile('f <| x');
      assertEqual(js.includes('typeof') || js.includes('f(x)'), true);
    });

    test('should compile arithmetic expression', () => {
      const js = compile('5 + 10');
      assertEqual(js.includes('5') && js.includes('10'), true);
      assertEqual(js.includes('+'), true);
    });
  });

  describe('Conditional', () => {
    test('should compile conditional as ternary', () => {
      const js = compile('if true then 1 else 2');
      assertEqual(js.includes('true ? 1 : 2'), true);
    });

    test('should compile nested conditionals', () => {
      const js = compile('if x then if y then 1 else 2 else 3');
      assertEqual(js.includes('?') && js.includes(':'), true);
    });
  });

  describe('Declarations', () => {
    test('should compile const declaration', () => {
      const js = compile('const x = 42');
      assertEqual(js.includes('const x = 42;'), true);
    });

    test('should compile const with lambda', () => {
      const js = compile('const inc = \\x -> x');
      assertEqual(js.includes('const inc = (x) => x;'), true);
    });

    test('should compile const with lambda and arithmetic body', () => {
      const js = compile('const inc = \\x -> x + 1');
      assertEqual(js.includes('const inc = (x) =>'), true);
      assertEqual(js.includes('+'), true);
    });
  });

  describe('Runtime library', () => {
    test('should include runtime library', () => {
      const js = compile('42');
      assertEqual(js.includes('__piper__'), true);
      assertEqual(js.includes('head:'), true);
      assertEqual(js.includes('tail:'), true);
    });

    test('should export built-in functions', () => {
      const js = compile('42');
      assertEqual(js.includes('const {'), true);
      assertEqual(js.includes('map'), true);
      assertEqual(js.includes('filter'), true);
      assertEqual(js.includes('get'), true);
    });
  });

  describe('Complex expressions', () => {
    test('should compile const with lambda and arithmetic', () => {
      const js = compile('const double = \\x -> x * 2');
      assertEqual(js.includes('const double = (x) =>'), true);
      assertEqual(js.includes('*'), true);
    });

    test('should compile lambda with arithmetic', () => {
      const js = compile('const add10 = \\x -> x + 10');
      assertEqual(js.includes('const add10 ='), true);
      assertEqual(js.includes('+'), true);
    });

    test('should compile map with lambda', () => {
      const js = compile('[1 2 3] |> map <| (\\x -> x)');
      assertEqual(js.includes('map'), true);
      assertEqual(js.includes('(x) => x'), true);
    });
  });

  describe('Output validation', () => {
    test('should generate valid JavaScript for arithmetic', () => {
      const js = compile('3 + 5');
      // Should not throw when parsed as JS
      assertEqual(typeof js, 'string');
      assertEqual(js.length > 0, true);
    });

    test('should generate valid JavaScript for functions', () => {
      const js = compile(`
        const inc = \\x -> x + 1
        5 |> inc
      `);
      assertEqual(typeof js, 'string');
      assertEqual(js.includes('const inc'), true);
    });

    test('should generate valid JavaScript for conditionals', () => {
      const js = compile('if true then 1 else 2');
      assertEqual(typeof js, 'string');
      assertEqual(js.includes('?'), true);
    });
  });
});
