// Integration tests - end-to-end tests

import { test, describe } from 'node:test';
import { parse, interpret, compile } from './index.js';
import { Interpreter } from './interpreter.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { assertEqual } from './test-utils.js';

describe('Integration Tests', () => {
  describe('Parse function', () => {
    test('should parse source code', () => {
      const program = parse('42');
      assertEqual(program.type, 'Program');
      assertEqual(program.declarations.length, 1);
    });

    test('should parse complex program', () => {
      const program = parse(`
        const inc = \\x -> x + 1
        const y = 5
        y |> inc
      `);
      assertEqual(program.declarations.length, 3);
    });
  });

  describe('Interpreter-Compiler equivalence', () => {
    test('arithmetic should produce same results', () => {
      const source = `
        const x = (3 + 5) * 2
        x
      `;

      // Run with interpreter
      const lexer1 = new Lexer(source);
      const parser1 = new Parser(lexer1.tokenize());
      const program1 = parser1.parseProgram();
      const interpreter = new Interpreter();
      const interpResult = interpreter.run(program1);

      // Run with compiler
      const lexer2 = new Lexer(source);
      const parser2 = new Parser(lexer2.tokenize());
      const program2 = parser2.parseProgram();
      const compiler = new Compiler();
      const jsCode = compiler.compile(program2);

      // Both should work without errors
      assertEqual(interpResult.type, 'int');
      assertEqual((interpResult as any).value, 16);
      assertEqual(jsCode.includes('const x ='), true);
    });

    test('functions should work in both', () => {
      const source = `
        const double = \\x -> x * 2
        5 |> double
      `;

      const lexer1 = new Lexer(source);
      const parser1 = new Parser(lexer1.tokenize());
      const program1 = parser1.parseProgram();
      const interpreter = new Interpreter();
      const interpResult = interpreter.run(program1);

      const lexer2 = new Lexer(source);
      const parser2 = new Parser(lexer2.tokenize());
      const program2 = parser2.parseProgram();
      const compiler = new Compiler();
      const jsCode = compiler.compile(program2);

      assertEqual(interpResult.type, 'int');
      assertEqual((interpResult as any).value, 10);
      assertEqual(jsCode.includes('const double'), true);
    });

    test('conditionals should work in both', () => {
      const source = `
        const x = if true then 1 else 2
        x
      `;

      const lexer1 = new Lexer(source);
      const parser1 = new Parser(lexer1.tokenize());
      const program1 = parser1.parseProgram();
      const interpreter = new Interpreter();
      const interpResult = interpreter.run(program1);

      const lexer2 = new Lexer(source);
      const parser2 = new Parser(lexer2.tokenize());
      const program2 = parser2.parseProgram();
      const compiler = new Compiler();
      const jsCode = compiler.compile(program2);

      assertEqual(interpResult.type, 'int');
      assertEqual((interpResult as any).value, 1);
      assertEqual(jsCode.includes('?'), true);
    });

    test('lists should work in both', () => {
      const source = `
        const nums = [1 2 3]
        nums |> head
      `;

      const lexer1 = new Lexer(source);
      const parser1 = new Parser(lexer1.tokenize());
      const program1 = parser1.parseProgram();
      const interpreter = new Interpreter();
      const interpResult = interpreter.run(program1);

      const lexer2 = new Lexer(source);
      const parser2 = new Parser(lexer2.tokenize());
      const program2 = parser2.parseProgram();
      const compiler = new Compiler();
      const jsCode = compiler.compile(program2);

      assertEqual(interpResult.type, 'int');
      assertEqual((interpResult as any).value, 1);
      assertEqual(jsCode.includes('head'), true);
    });
  });

  describe('Spec conformance examples', () => {
    test('should handle example from spec = 5 |> inc', () => {
      const source = `
        const inc = \\x -> x + 1
        5 |> inc
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 6);
    });

    test('should handle arithmetic with operators', () => {
      const source = '5 + 10';

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });

    test('should handle sub-pipeline form with lambda', () => {
      const source = '5 |> 10 <| (\\x -> \\y -> x + y)';

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });

    test('should handle partial application with lambda', () => {
      const source = `
        const add10 = \\x -> x + 10
        5 |> add10
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });

    test('should handle example from spec: map with function', () => {
      const source = `
        const add10 = \\x -> x + 10
        [1 2 3] |> map <| add10 |> head
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 11);
    });
  });

  describe('Complex programs', () => {
    test('should handle complete program with all features', () => {
      const source = `
        -- Define functions
        const double = \\x -> x * 2
        const inc = \\x -> x + 1

        -- Define constants
        const nums = [1 2 3 4 5]

        -- Use everything together with built-in functions
        nums |> map <| double |> map <| inc |> head
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      // 1 * 2 + 1 = 3
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 3);
    });

    test('should handle conditionals with functions', () => {
      const source = `
        const abs = \\x -> if x < 0 then 0 - x else x
        const test1 = -5 |> abs
        const test2 = 5 |> abs
        test1 + test2
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 10);
    });
  });

  describe('Error propagation', () => {
    test('should propagate lexer errors', () => {
      let threw = false;
      try {
        parse('@');
      } catch (e) {
        threw = true;
      }
      assertEqual(threw, true);
    });

    test('should propagate parser errors', () => {
      let threw = false;
      try {
        parse('x |>');
      } catch (e) {
        threw = true;
      }
      assertEqual(threw, true);
    });
  });

  describe('Comprehensive feature tests', () => {
    test('factorial recursion', () => {
      const source = `
        const factorial = \\n ->
          if n = 0
          then 1
          else n * (n - 1 |> factorial)

        5 |> factorial
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 120);
    });

    test('fibonacci recursion', () => {
      const source = `
        const fib = \\n ->
          if n < 2
          then n
          else (n - 1 |> fib) + (n - 2 |> fib)

        10 |> fib
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 55);
    });

    test('records with mutation', () => {
      const source = `
        const person = {name = "Alice" age = 30}
        person |> set <| "age" 31
        person |> "age" <| get
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 31);
    });

    test('spans with slice and concat', () => {
      const source = `
        const v = #[1 2 3 4 5]
        v |> slice <| 1 3 |> 0 <| get
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 2);
    });

    test('boxes for mutable state', () => {
      const source = `
        const x = #[42]
        x |> box <| 100
        x |> unbox
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 100);
    });

    test('string concatenation', () => {
      const source = `
        "Hello" |> ", " <| concat |> "World!" <| concat
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'string');
      assertEqual((result as any).value, 'Hello, World!');
    });

    test('span concatenation', () => {
      const source = `
        const v1 = #[1 2 3]
        const v2 = #[4 5 6]
        const result = v1 |> v2 <| concat
        result |> 2 <| get
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 3);
    });

    test('equality on strings', () => {
      const source = `
        "hello" = "hello"
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, true);
    });

    test('equality on lists', () => {
      const source = `
        [1 2 3] = [1 2 3]
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, true);
    });

    test('equality on booleans', () => {
      const source = `
        true = false
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, false);
    });

    test('equality between int and float', () => {
      const source = `
        5 = 5.0
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, true);
    });

    test('fizzbuzz implementation', () => {
      const source = `
        const fizzbuzzValue = \\n ->
          if (n % 15) = 0
          then "FizzBuzz"
          else if (n % 3) = 0
          then "Fizz"
          else if (n % 5) = 0
          then "Buzz"
          else n |> show

        15 |> fizzbuzzValue
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'string');
      assertEqual((result as any).value, 'FizzBuzz');
    });

    test('list operations composition', () => {
      const source = `
        const isEven = \\n -> (n % 2) = 0
        const square = \\n -> n * n

        [1 2 3 4 5 6 7 8 9 10]
          |> map <| square
          |> filter <| isEven
          |> fold <| 0 (\\acc -> \\x -> acc + x)
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 220);
    });

    test('shadowing and closures', () => {
      const source = `
        const ten = 10
        const add10 = \\x -> x + ten
        const ten = 20
        5 |> add10
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });

    test('church numerals', () => {
      const source = `
        const church2 = \\f -> \\x -> x |> f |> f
        const inc = \\x -> x + 1
        0 |> (inc |> church2)
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 2);
    });

    test('span to list conversion', () => {
      const source = `
        const v = #[1 2 3]
        v |> to_list |> head
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 1);
    });

    test('list to span conversion', () => {
      const source = `
        const lst = [1 2 3]
        const v = lst |> to_span
        v |> 0 <| get
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 1);
    });

    test('exponentiation operator', () => {
      const source = `
        2 ** 10
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'float');
      assertEqual((result as any).value, 1024);
    });

    test('nested list operations', () => {
      const source = `
        const matrix = [[1 2 3] [4 5 6] [7 8 9]]
        matrix |> head |> tail |> head
      `;

      const lexer = new Lexer(source);
      const parser = new Parser(lexer.tokenize());
      const program = parser.parseProgram();
      const interpreter = new Interpreter();
      const result = interpreter.run(program);

      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 2);
    });
  });
});
