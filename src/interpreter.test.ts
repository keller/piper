// Interpreter tests

import { test, describe } from 'node:test';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Interpreter, RuntimeValue } from './interpreter.js';
import { assertEqual, assertDeepEqual, assertThrows } from './test-utils.js';

function run(source: string): RuntimeValue {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parseProgram();
  const interpreter = new Interpreter();
  return interpreter.run(program);
}

describe('Interpreter', () => {
  describe('Literals', () => {
    test('should evaluate integer literal', () => {
      const result = run('42');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 42);
    });

    test('should evaluate float literal', () => {
      const result = run('3.14');
      assertEqual(result.type, 'float');
      assertEqual((result as any).value, 3.14);
    });

    test('should evaluate string literal', () => {
      const result = run('"hello"');
      assertEqual(result.type, 'string');
      assertEqual((result as any).value, 'hello');
    });

    test('should evaluate boolean literals', () => {
      const result = run('true');
      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, true);
    });

    test('should evaluate unit literal', () => {
      const result = run('()');
      assertEqual(result.type, 'unit');
    });

    test('should evaluate list literal', () => {
      const result = run('[1 2 3]');
      assertEqual(result.type, 'list');
      assertEqual((result as any).elements.length, 3);
    });
  });

  describe('Arithmetic', () => {
    test('should add numbers', () => {
      const result = run('3 + 5');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 8);
    });

    test('should subtract numbers', () => {
      const result = run('10 - 3');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 7);
    });

    test('should multiply numbers', () => {
      const result = run('4 * 3');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 12);
    });

    test('should divide numbers', () => {
      const result = run('10 / 2');
      assertEqual(result.type, 'float');
      assertEqual((result as any).value, 5);
    });

    test('should chain arithmetic operations', () => {
      const result = run('(10 + 5) * 2');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 30);
    });

    test('should handle negative numbers', () => {
      const result = run('-5');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, -5);
    });

    test('should handle operator precedence', () => {
      const result = run('2 + 3 * 4');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 14);
    });

    test('should calculate modulo', () => {
      const result = run('10 % 3');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 1);
    });

    test('should exponentiate numbers', () => {
      const result = run('2 ** 3');
      assertEqual(result.type, 'float');
      assertEqual((result as any).value, 8);
    });

    test('should handle exponentiation right-associativity', () => {
      const result = run('2 ** 3 ** 2');
      assertEqual(result.type, 'float');
      assertEqual((result as any).value, 512); // 2 ** (3 ** 2) = 2 ** 9
    });

    test('should handle exponentiation precedence', () => {
      const result = run('3 * 2 ** 4');
      assertEqual(result.type, 'float');
      assertEqual((result as any).value, 48); // 3 * (2 ** 4) = 3 * 16
    });

    test('should handle negative base with parentheses', () => {
      const result = run('(-2) ** 2');
      assertEqual(result.type, 'float');
      assertEqual((result as any).value, 4); // (-2) ** 2 = 4
    });
  });

  describe('Comparison', () => {
    test('should compare equality', () => {
      const result = run('5 = 5');
      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, true);
    });

    test('should compare less than', () => {
      const result = run('3 < 5');
      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, true);
    });

    test('should compare greater than', () => {
      const result = run('7 > 5');
      assertEqual(result.type, 'bool');
      assertEqual((result as any).value, true);
    });
  });

  describe('Conditionals', () => {
    test('should evaluate then branch when true', () => {
      const result = run('if true then 1 else 2');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 1);
    });

    test('should evaluate else branch when false', () => {
      const result = run('if false then 1 else 2');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 2);
    });

    test('should evaluate nested conditionals', () => {
      const result = run('if true then if false then 1 else 2 else 3');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 2);
    });

    test('should evaluate conditional with pipeline', () => {
      const result = run('if 5 < 10 then 1 else 2');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 1);
    });
  });

  describe('Lambda', () => {
    test('should create and apply lambda', () => {
      const result = run('5 |> (\\x -> x)');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 5);
    });

    test('should apply lambda with arithmetic', () => {
      const result = run('5 |> (\\x -> x + 1)');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 6);
    });

    test('should support currying', () => {
      const result = run('3 |> (\\x -> \\y -> x + y) <| 5');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 8);
    });
  });

  describe('Function definitions', () => {
    test('should define and use function', () => {
      const result = run('const inc = \\x -> x + 1\n5 |> inc');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 6);
    });

    test('should support multiple function definitions', () => {
      const result = run(`
        const double = \\x -> x * 2
        const inc = \\x -> x + 1
        5 |> inc |> double
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 12);
    });

    test('should support function with lambda body', () => {
      const result = run('const multiply = \\a -> \\b -> a * b\n3 |> multiply <| 5');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });
  });

  describe('Const declarations', () => {
    test('should define and use const', () => {
      const result = run('const x = 42\nx');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 42);
    });

    test('should use const in arithmetic', () => {
      const result = run('const x = 5\nx + 10');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });

    test('should support const with lambda', () => {
      const result = run('const double = \\x -> x * 2\n5 |> double');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 10);
    });

    test('should support shadowing with lexical scoping', () => {
      const result = run(`
        const ten = 10
        const add10 = \\x -> x + ten
        const ten = 20
        5 |> add10
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15); // Closure captured ten=10, not ten=20
    });

    test('should shadow in nested closures correctly', () => {
      const result = run(`
        const x = 5
        const f = \\y -> x + y
        const x = 10
        3 |> f
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 8); // Closure captured x=5, not x=10
    });

    test('should allow multiple shadows', () => {
      const result = run(`
        const n = 1
        const n = 2
        const n = 3
        n
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 3);
    });
  });

  describe('Recursion', () => {
    test('should support recursive factorial', () => {
      const result = run(`
        const factorial = \\n ->
          if n = 0
          then 1
          else n * (n - 1 |> factorial)

        5 |> factorial
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 120);
    });

    test('should support recursive fibonacci', () => {
      const result = run(`
        const fib = \\n ->
          if n < 2
          then n
          else (n - 1 |> fib) + (n - 2 |> fib)

        10 |> fib
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 55);
    });

    test('should support recursive countdown', () => {
      const result = run(`
        const countdown = \\n ->
          if n = 0
          then 0
          else n - 1 |> countdown

        100 |> countdown
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 0);
    });
  });

  describe('Stage operator', () => {
    test('should create partial application with lambda', () => {
      const result = run('const add10 = \\x -> x + 10\n5 |> add10');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });

    test('should handle sub-pipeline form', () => {
      const result = run('5 |> 10 <| (\\x -> \\y -> x + y)');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 15);
    });

    test('should be right-associative', () => {
      const result = run('const add5 = \\x -> x + 5\nconst add10 = \\x -> x + 10\n3 |> add5 |> add10');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 18); // 3 + 5 + 10
    });
  });

  describe('List operations', () => {
    test('should get head of list', () => {
      const result = run('[1 2 3] |> head');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 1);
    });

    test('should get tail of list', () => {
      const result = run('[1 2 3] |> tail');
      assertEqual(result.type, 'list');
      assertEqual((result as any).elements.length, 2);
      assertEqual((result as any).elements[0].value, 2);
    });

    test('should cons element to list', () => {
      const result = run('0 |> cons <| [1 2 3]');
      assertEqual(result.type, 'list');
      assertEqual((result as any).elements.length, 4);
      assertEqual((result as any).elements[0].value, 0);
    });

    test('should get length of list', () => {
      const result = run('[1 2 3 4 5] |> length');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 5);
    });

    test('should map over list', () => {
      const result = run('const add10 = \\x -> x + 10\n[1 2 3] |> map <| add10');
      assertEqual(result.type, 'list');
      assertEqual((result as any).elements.length, 3);
      assertEqual((result as any).elements[0].value, 11);
      assertEqual((result as any).elements[1].value, 12);
      assertEqual((result as any).elements[2].value, 13);
    });
  });

  describe('String operations', () => {
    test('should concatenate strings', () => {
      const result = run('"hello" |> concat <| ", " |> concat <| "world"');
      assertEqual(result.type, 'string');
      assertEqual((result as any).value, 'hello, world');
    });
  });

  describe('Record operations', () => {
    test('should access record field with get', () => {
      const result = run('const person = {name = "Alice" age = 30}\nperson |> get <| "name"');
      assertEqual(result.type, 'string');
      assertEqual((result as any).value, 'Alice');
    });

    test('should access numeric field with get', () => {
      const result = run('const person = {name = "Bob" age = 42}\nperson |> get <| "age"');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 42);
    });

    test('should throw on missing field', () => {
      assertThrows(() => run('{x = 10} |> get <| "y"'), 'field \'y\' not found');
    });

    test('should mutate record field with set', () => {
      const result = run(`
        const person = {name = "Alice" age = 30}
        person |> set <| "age" 31
        person |> get <| "age"
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 31);
    });

    test('should chain set operations', () => {
      const result = run(`
        const person = {name = "Alice" age = 30}
        person |> set <| "age" 31 |> set <| "name" "Bob" |> get <| "name"
      `);
      assertEqual(result.type, 'string');
      assertEqual((result as any).value, 'Bob');
    });

    test('should verify mutation persists', () => {
      const result = run(`
        const person = {name = "Alice" age = 30}
        const x = person |> set <| "age" 31
        person |> get <| "age"
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 31);
    });

    test('should throw on set with non-string field name', () => {
      assertThrows(() => run('{x = 10} |> set <| 42 10'), 'field name must be a string');
    });

    test('should throw on set with non-record', () => {
      assertThrows(() => run('42 |> set <| "x" 10'), 'third argument must be a record');
    });
  });

  describe('Span operations', () => {
    test('should create span literal', () => {
      const result = run('#[1 2 3]');
      assertEqual(result.type, 'span');
      assertEqual((result as any).elements.length, 3);
      assertEqual((result as any).elements[0].value, 1);
      assertEqual((result as any).elements[1].value, 2);
      assertEqual((result as any).elements[2].value, 3);
    });

    test('should get element from span', () => {
      const result = run('#[10 20 30] |> get <| 1');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 20);
    });

    test('should set element in span', () => {
      const result = run(`
        const v = #[1 2 3]
        v |> set <| 1 99
        v |> get <| 1
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 99);
    });

    test('should slice span', () => {
      const result = run(`
        const v = #[1 2 3 4 5]
        v |> slice <| 1 3
      `);
      assertEqual(result.type, 'span');
      assertEqual((result as any).elements.length, 2);
      assertEqual((result as any).elements[0].value, 2);
      assertEqual((result as any).elements[1].value, 3);
    });

    test('should convert span to list', () => {
      const result = run(`
        const v = #[1 2 3]
        v |> to_list
      `);
      assertEqual(result.type, 'list');
      assertEqual((result as any).elements.length, 3);
    });

    test('should convert list to span', () => {
      const result = run(`
        const l = [1 2 3]
        l |> to_span
      `);
      assertEqual(result.type, 'span');
      assertEqual((result as any).elements.length, 3);
    });

    test('should throw on get with out of bounds index', () => {
      assertThrows(() => run('#[1 2 3] |> get <| 5'), 'out of bounds');
    });

    test('should throw on set with out of bounds index', () => {
      assertThrows(() => run('#[1 2 3] |> set <| 5 99'), 'out of bounds');
    });

    test('should unbox from box', () => {
      const result = run('#[42] |> unbox');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 42);
    });

    test('should box to box', () => {
      const result = run(`
        const x = #[42]
        x |> box <| 100
        x |> unbox
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 100);
    });

    test('should throw on unbox from empty span', () => {
      assertThrows(() => run('#[] |> unbox'), 'cannot unbox from empty span');
    });

    test('should throw on box to empty span', () => {
      assertThrows(() => run('#[] |> box <| 42'), 'cannot box to empty span');
    });

    test('should use box for mutable counter', () => {
      const result = run(`
        const counter = #[0]
        const increment = \\_ ->
          counter |> unbox
            |> (\\n -> counter |> box <| (n + 1))

        () |> increment
        () |> increment
        () |> increment
        counter |> unbox
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 3);
    });

    test('should use box in closures', () => {
      const result = run(`
        const num = #[10]
        const addNum = \\x -> x + (num |> unbox)

        num |> box <| 20

        5 |> addNum
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 25);
    });
  });

  describe('Boolean operations', () => {
    test('should perform logical and', () => {
      const result1 = run('true |> and <| true');
      assertEqual(result1.type, 'bool');
      assertEqual((result1 as any).value, true);

      const result2 = run('true |> and <| false');
      assertEqual(result2.type, 'bool');
      assertEqual((result2 as any).value, false);

      const result3 = run('false |> and <| false');
      assertEqual(result3.type, 'bool');
      assertEqual((result3 as any).value, false);
    });

    test('should perform logical or', () => {
      const result1 = run('true |> or <| false');
      assertEqual(result1.type, 'bool');
      assertEqual((result1 as any).value, true);

      const result2 = run('false |> or <| false');
      assertEqual(result2.type, 'bool');
      assertEqual((result2 as any).value, false);

      const result3 = run('true |> or <| true');
      assertEqual(result3.type, 'bool');
      assertEqual((result3 as any).value, true);
    });

    test('should throw on non-boolean arguments', () => {
      assertThrows(() => run('true |> or <| "blah"'), 'must be a boolean');
      assertThrows(() => run('"hello" |> and <| true'), 'must be a boolean');
      assertThrows(() => run('42 |> or <| 0'), 'must be a boolean');
      assertThrows(() => run('[1 2 3] |> and <| true'), 'must be a boolean');
    });
  });

  describe('Top-level pipeline', () => {
    test('should execute leading pipe with unit', () => {
      const result = run('|> (\\x -> 42)');
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 42);
    });
  });

  describe('Complex programs', () => {
    test('should evaluate complete program', () => {
      const result = run(`
        const double = \\x -> x * 2
        const add10 = \\x -> x + 10

        5 |> add10 |> double
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 30);
    });

    test('should handle conditional in function', () => {
      const result = run(`
        const abs = \\x -> if x < 0 then 0 - x else x
        (-5) |> abs
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 5);
    });

    test('should handle complex list operations', () => {
      const result = run(`
        const double = \\x -> x * 2
        [1 2 3] |> map <| double |> head
      `);
      assertEqual(result.type, 'int');
      assertEqual((result as any).value, 2);
    });
  });

  describe('Error handling', () => {
    test('should throw on undefined variable', () => {
      assertThrows(() => run('x'), 'Undefined variable');
    });

    test('should throw on non-function in pipeline', () => {
      assertThrows(() => run('5 |> 10'), 'Cannot apply non-function');
    });

    test('should throw on division by zero', () => {
      assertThrows(() => run('10 / 0'), 'Division by zero');
    });

    test('should throw on head of empty list', () => {
      assertThrows(() => run('[] |> head'), 'list is empty');
    });

    test('should throw on tail of empty list', () => {
      assertThrows(() => run('[] |> tail'), 'list is empty');
    });

    test('should throw on non-boolean condition', () => {
      assertThrows(() => run('if 1 then 2 else 3'), 'must be a boolean');
    });
  });
});
