// Parser tests

import { test, describe } from 'node:test';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import * as AST from './ast.js';
import { assertEqual, assertDeepEqual, assertThrows } from './test-utils.js';

function parse(source: string): AST.Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

describe('Parser', () => {
  describe('Literals', () => {
    test('should parse integer literal', () => {
      const program = parse('42');
      assertEqual(program.declarations.length, 1);
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      assertEqual(decl.type, 'TopLevelPipeline');
      const expr = decl.expr as AST.IntLiteral;
      assertEqual(expr.type, 'IntLiteral');
      assertEqual(expr.value, 42);
    });

    test('should parse float literal', () => {
      const program = parse('3.14');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.FloatLiteral;
      assertEqual(expr.type, 'FloatLiteral');
      assertEqual(expr.value, 3.14);
    });

    test('should parse string literal', () => {
      const program = parse('"hello"');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.StringLiteral;
      assertEqual(expr.type, 'StringLiteral');
      assertEqual(expr.value, 'hello');
    });

    test('should parse boolean literals', () => {
      const program = parse('true');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.BoolLiteral;
      assertEqual(expr.type, 'BoolLiteral');
      assertEqual(expr.value, true);
    });

    test('should parse unit literal', () => {
      const program = parse('()');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.UnitLiteral;
      assertEqual(expr.type, 'UnitLiteral');
    });

    test('should parse list literal', () => {
      const program = parse('[1 2 3]');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.ListLiteral;
      assertEqual(expr.type, 'ListLiteral');
      assertEqual(expr.elements.length, 3);
      assertEqual((expr.elements[0] as AST.IntLiteral).value, 1);
      assertEqual((expr.elements[1] as AST.IntLiteral).value, 2);
      assertEqual((expr.elements[2] as AST.IntLiteral).value, 3);
    });

    test('should parse empty list', () => {
      const program = parse('[]');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.ListLiteral;
      assertEqual(expr.type, 'ListLiteral');
      assertEqual(expr.elements.length, 0);
    });

    test('should parse span literal', () => {
      const program = parse('#[1 2 3]');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.SpanLiteral;
      assertEqual(expr.type, 'SpanLiteral');
      assertEqual(expr.elements.length, 3);
      assertEqual((expr.elements[0] as AST.IntLiteral).value, 1);
      assertEqual((expr.elements[1] as AST.IntLiteral).value, 2);
      assertEqual((expr.elements[2] as AST.IntLiteral).value, 3);
    });

    test('should parse empty span', () => {
      const program = parse('#[]');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.SpanLiteral;
      assertEqual(expr.type, 'SpanLiteral');
      assertEqual(expr.elements.length, 0);
    });

    test('should parse record literal', () => {
      const program = parse('{x = 10 y = 20}');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.RecordLiteral;
      assertEqual(expr.type, 'RecordLiteral');
      assertEqual(expr.fields.length, 2);
      assertEqual(expr.fields[0].name, 'x');
      assertEqual((expr.fields[0].value as AST.IntLiteral).value, 10);
      assertEqual(expr.fields[1].name, 'y');
      assertEqual((expr.fields[1].value as AST.IntLiteral).value, 20);
    });
  });

  describe('Identifiers', () => {
    test('should parse identifier', () => {
      const program = parse('x');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.Identifier;
      assertEqual(expr.type, 'Identifier');
      assertEqual(expr.name, 'x');
    });
  });

  describe('Lambda', () => {
    test('should parse lambda', () => {
      const program = parse('\\x -> x');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.Lambda;
      assertEqual(expr.type, 'Lambda');
      assertEqual(expr.param, 'x');
      assertEqual((expr.body as AST.Identifier).name, 'x');
    });

    test('should parse nested lambda', () => {
      const program = parse('\\x -> \\y -> x');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const outer = decl.expr as AST.Lambda;
      assertEqual(outer.type, 'Lambda');
      assertEqual(outer.param, 'x');
      const inner = outer.body as AST.Lambda;
      assertEqual(inner.type, 'Lambda');
      assertEqual(inner.param, 'y');
      assertEqual((inner.body as AST.Identifier).name, 'x');
    });
  });

  describe('Pipeline', () => {
    test('should parse simple pipeline', () => {
      const program = parse('x |> f');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.Pipeline;
      assertEqual(expr.type, 'Pipeline');
      assertEqual((expr.left as AST.Identifier).name, 'x');
      assertEqual((expr.right as AST.Identifier).name, 'f');
    });

    test('should parse chained pipeline (left-associative)', () => {
      const program = parse('x |> f |> g');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const outer = decl.expr as AST.Pipeline;
      assertEqual(outer.type, 'Pipeline');
      const inner = outer.left as AST.Pipeline;
      assertEqual(inner.type, 'Pipeline');
      assertEqual((inner.left as AST.Identifier).name, 'x');
      assertEqual((inner.right as AST.Identifier).name, 'f');
      assertEqual((outer.right as AST.Identifier).name, 'g');
    });

    test('should parse pipeline with | alias', () => {
      const program = parse('x | f');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.Pipeline;
      assertEqual(expr.type, 'Pipeline');
      assertEqual((expr.left as AST.Identifier).name, 'x');
      assertEqual((expr.right as AST.Identifier).name, 'f');
    });
  });

  describe('Stage', () => {
    test('should parse stage with single argument', () => {
      const program = parse('f <| x');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.Stage;
      assertEqual(expr.type, 'Stage');
      assertEqual((expr.fn as AST.Identifier).name, 'f');
      assertEqual(expr.args.length, 1);
      assertEqual((expr.args[0] as AST.Identifier).name, 'x');
    });

    test('should parse stage with right-associativity', () => {
      const program = parse('a <| b <| c');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const outer = decl.expr as AST.Stage;
      assertEqual(outer.type, 'Stage');
      assertEqual((outer.fn as AST.Identifier).name, 'a');
      const inner = outer.args[0] as AST.Stage;
      assertEqual(inner.type, 'Stage');
      assertEqual((inner.fn as AST.Identifier).name, 'b');
      assertEqual((inner.args[0] as AST.Identifier).name, 'c');
    });

    test('should parse stage with higher precedence than pipeline', () => {
      const program = parse('x |> 10 <| add');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const pipe = decl.expr as AST.Pipeline;
      assertEqual(pipe.type, 'Pipeline');
      assertEqual((pipe.left as AST.Identifier).name, 'x');
      const stage = pipe.right as AST.Stage;
      assertEqual(stage.type, 'Stage');
      assertEqual((stage.fn as AST.IntLiteral).value, 10);
      assertEqual((stage.args[0] as AST.Identifier).name, 'add');
    });
  });

  describe('Conditional', () => {
    test('should parse if-then-else', () => {
      const program = parse('if true then 1 else 2');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const expr = decl.expr as AST.Conditional;
      assertEqual(expr.type, 'Conditional');
      assertEqual((expr.condition as AST.BoolLiteral).value, true);
      assertEqual((expr.thenBranch as AST.IntLiteral).value, 1);
      assertEqual((expr.elseBranch as AST.IntLiteral).value, 2);
    });

    test('should parse nested conditionals', () => {
      const program = parse('if x then if y then 1 else 2 else 3');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const outer = decl.expr as AST.Conditional;
      assertEqual(outer.type, 'Conditional');
      const inner = outer.thenBranch as AST.Conditional;
      assertEqual(inner.type, 'Conditional');
      assertEqual((inner.thenBranch as AST.IntLiteral).value, 1);
      assertEqual((inner.elseBranch as AST.IntLiteral).value, 2);
      assertEqual((outer.elseBranch as AST.IntLiteral).value, 3);
    });
  });

  describe('Declarations', () => {
    test('should parse const declaration', () => {
      const program = parse('const x = 42');
      assertEqual(program.declarations.length, 1);
      const decl = program.declarations[0] as AST.ConstDecl;
      assertEqual(decl.type, 'ConstDecl');
      assertEqual(decl.name, 'x');
      assertEqual((decl.value as AST.IntLiteral).value, 42);
    });

    test('should parse const with lambda', () => {
      const program = parse('const inc = \\x -> x');
      assertEqual(program.declarations.length, 1);
      const decl = program.declarations[0] as AST.ConstDecl;
      assertEqual(decl.type, 'ConstDecl');
      assertEqual(decl.name, 'inc');
      const lambda = decl.value as AST.Lambda;
      assertEqual(lambda.type, 'Lambda');
      assertEqual(lambda.param, 'x');
      assertEqual((lambda.body as AST.Identifier).name, 'x');
    });

    test('should parse multiple declarations', () => {
      const program = parse('const x = 1\nconst y = 2');
      assertEqual(program.declarations.length, 2);
      assertEqual((program.declarations[0] as AST.ConstDecl).name, 'x');
      assertEqual((program.declarations[1] as AST.ConstDecl).name, 'y');
    });
  });

  describe('Top-level pipeline', () => {
    test('should parse leading pipe', () => {
      const program = parse('|> f');
      assertEqual(program.declarations.length, 1);
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const pipe = decl.expr as AST.Pipeline;
      assertEqual(pipe.type, 'Pipeline');
      assertEqual((pipe.left as AST.UnitLiteral).type, 'UnitLiteral');
      assertEqual((pipe.right as AST.Identifier).name, 'f');
    });

    test('should parse leading pipe with chaining', () => {
      const program = parse('|> f |> g');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const outer = decl.expr as AST.Pipeline;
      const inner = outer.left as AST.Pipeline;
      assertEqual((inner.left as AST.UnitLiteral).type, 'UnitLiteral');
      assertEqual((inner.right as AST.Identifier).name, 'f');
      assertEqual((outer.right as AST.Identifier).name, 'g');
    });
  });

  describe('Parentheses', () => {
    test('should parse parenthesized expression', () => {
      const program = parse('(42)');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const parens = decl.expr as AST.Parens;
      assertEqual(parens.type, 'Parens');
      assertEqual((parens.expr as AST.IntLiteral).value, 42);
    });

    test('should allow grouping with parentheses', () => {
      const program = parse('(x |> f) |> g');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const outer = decl.expr as AST.Pipeline;
      const parens = outer.left as AST.Parens;
      assertEqual(parens.type, 'Parens');
      const inner = parens.expr as AST.Pipeline;
      assertEqual(inner.type, 'Pipeline');
    });
  });

  describe('Arithmetic operations', () => {
    test('should parse exponentiation', () => {
      const program = parse('2 ** 3');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const binop = decl.expr as AST.BinaryOp;
      assertEqual(binop.type, 'BinaryOp');
      assertEqual(binop.op, '**');
      assertEqual((binop.left as AST.IntLiteral).value, 2);
      assertEqual((binop.right as AST.IntLiteral).value, 3);
    });

    test('should parse exponentiation right-associativity', () => {
      const program = parse('2 ** 3 ** 4');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const outer = decl.expr as AST.BinaryOp;
      assertEqual(outer.type, 'BinaryOp');
      assertEqual(outer.op, '**');
      assertEqual((outer.left as AST.IntLiteral).value, 2);
      // Right side should be another exponentiation
      const inner = outer.right as AST.BinaryOp;
      assertEqual(inner.type, 'BinaryOp');
      assertEqual(inner.op, '**');
      assertEqual((inner.left as AST.IntLiteral).value, 3);
      assertEqual((inner.right as AST.IntLiteral).value, 4);
    });

    test('should parse exponentiation with higher precedence than multiplication', () => {
      const program = parse('3 * 2 ** 4');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const mult = decl.expr as AST.BinaryOp;
      assertEqual(mult.type, 'BinaryOp');
      assertEqual(mult.op, '*');
      assertEqual((mult.left as AST.IntLiteral).value, 3);
      // Right side should be exponentiation
      const exp = mult.right as AST.BinaryOp;
      assertEqual(exp.type, 'BinaryOp');
      assertEqual(exp.op, '**');
      assertEqual((exp.left as AST.IntLiteral).value, 2);
      assertEqual((exp.right as AST.IntLiteral).value, 4);
    });

    test('should parse modulo operator', () => {
      const program = parse('10 % 3');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const binop = decl.expr as AST.BinaryOp;
      assertEqual(binop.type, 'BinaryOp');
      assertEqual(binop.op, '%');
      assertEqual((binop.left as AST.IntLiteral).value, 10);
      assertEqual((binop.right as AST.IntLiteral).value, 3);
    });
  });

  describe('Complex expressions', () => {
    test('should parse const with lambda and arithmetic', () => {
      const program = parse('const inc = \\x -> x + 1');
      const decl = program.declarations[0] as AST.ConstDecl;
      assertEqual(decl.type, 'ConstDecl');
      assertEqual(decl.name, 'inc');
      const lambda = decl.value as AST.Lambda;
      assertEqual(lambda.type, 'Lambda');
      assertEqual(lambda.param, 'x');
      const binop = lambda.body as AST.BinaryOp;
      assertEqual(binop.type, 'BinaryOp');
      assertEqual(binop.op, '+');
    });

    test('should parse lambda in pipeline', () => {
      const program = parse('[1 2 3] |> map <| (\\x -> x)');
      const decl = program.declarations[0] as AST.TopLevelPipeline;
      const pipe = decl.expr as AST.Pipeline;
      assertEqual(pipe.type, 'Pipeline');
      // The right side should be a stage
      const stage = pipe.right as AST.Stage;
      assertEqual(stage.type, 'Stage');
      // The stage arg should be a parenthesized lambda
      const parens = stage.args[0] as AST.Parens;
      assertEqual(parens.type, 'Parens');
      const lambda = parens.expr as AST.Lambda;
      assertEqual(lambda.type, 'Lambda');
    });
  });

  describe('Error handling', () => {
    test('should throw on unexpected token', () => {
      assertThrows(() => parse('x |>'), 'Unexpected token');
    });

    test('should throw on missing closing paren', () => {
      assertThrows(() => parse('(42'), 'Expected RPAREN');
    });

    test('should throw on missing then in conditional', () => {
      assertThrows(() => parse('if true else 1'), 'Expected THEN');
    });
  });
});
