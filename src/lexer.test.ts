// Lexer tests

import { test, describe } from 'node:test';
import { Lexer, TokenType } from './lexer.js';
import { assertEqual, assertDeepEqual, assertThrows } from './test-utils.js';

describe('Lexer', () => {
  describe('Keywords', () => {
    test('should tokenize const keyword', () => {
      const lexer = new Lexer('const');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.CONST);
    });

    test('should tokenize if/then/else keywords', () => {
      const lexer = new Lexer('if then else');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.IF);
      assertEqual(tokens[1].type, TokenType.THEN);
      assertEqual(tokens[2].type, TokenType.ELSE);
    });

    test('should tokenize boolean keywords', () => {
      const lexer = new Lexer('true false');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.TRUE);
      assertEqual(tokens[0].value, true);
      assertEqual(tokens[1].type, TokenType.FALSE);
      assertEqual(tokens[1].value, false);
    });
  });

  describe('Literals', () => {
    test('should tokenize integers', () => {
      const lexer = new Lexer('0 42 123');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.INT);
      assertEqual(tokens[0].value, 0);
      assertEqual(tokens[1].type, TokenType.INT);
      assertEqual(tokens[1].value, 42);
      assertEqual(tokens[2].type, TokenType.INT);
      assertEqual(tokens[2].value, 123);
    });

    test('should tokenize minus operator with integers', () => {
      const lexer = new Lexer('-5');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.MINUS);
      assertEqual(tokens[1].type, TokenType.INT);
      assertEqual(tokens[1].value, 5);
    });

    test('should tokenize floats', () => {
      const lexer = new Lexer('3.14');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.FLOAT);
      assertEqual(tokens[0].value, 3.14);
    });

    test('should tokenize strings', () => {
      const lexer = new Lexer('"hello" "world"');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.STRING);
      assertEqual(tokens[0].value, 'hello');
      assertEqual(tokens[1].type, TokenType.STRING);
      assertEqual(tokens[1].value, 'world');
    });

    test('should handle string escapes', () => {
      const lexer = new Lexer('"hello\\nworld" "tab\\there"');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].value, 'hello\nworld');
      assertEqual(tokens[1].value, 'tab\there');
    });
  });

  describe('Operators', () => {
    test('should tokenize pipe operators', () => {
      const lexer = new Lexer('|> |');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.PIPE);
      assertEqual(tokens[0].value, '|>');
      assertEqual(tokens[1].type, TokenType.PIPE);
      assertEqual(tokens[1].value, '|');
    });

    test('should tokenize stage operator', () => {
      const lexer = new Lexer('<|');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.STAGE);
      assertEqual(tokens[0].value, '<|');
    });

    test('should tokenize lambda and arrow', () => {
      const lexer = new Lexer('\\ ->');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.LAMBDA);
      assertEqual(tokens[0].value, '\\');
      assertEqual(tokens[1].type, TokenType.ARROW);
      assertEqual(tokens[1].value, '->');
    });

    test('should tokenize equals', () => {
      const lexer = new Lexer('=');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.EQUALS);
    });
  });

  describe('Punctuation', () => {
    test('should tokenize parentheses', () => {
      const lexer = new Lexer('( )');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.LPAREN);
      assertEqual(tokens[1].type, TokenType.RPAREN);
    });

    test('should tokenize brackets', () => {
      const lexer = new Lexer('[ ]');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.LBRACK);
      assertEqual(tokens[1].type, TokenType.RBRACK);
    });

    test('should tokenize braces', () => {
      const lexer = new Lexer('{ }');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.LBRACE);
      assertEqual(tokens[1].type, TokenType.RBRACE);
    });

    test('should tokenize comma and colon', () => {
      const lexer = new Lexer(', :');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.COMMA);
      assertEqual(tokens[1].type, TokenType.COLON);
    });
  });

  describe('Identifiers', () => {
    test('should tokenize identifiers', () => {
      const lexer = new Lexer('x foo bar123');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.IDENTIFIER);
      assertEqual(tokens[0].value, 'x');
      assertEqual(tokens[1].type, TokenType.IDENTIFIER);
      assertEqual(tokens[1].value, 'foo');
      assertEqual(tokens[2].type, TokenType.IDENTIFIER);
      assertEqual(tokens[2].value, 'bar123');
    });

    test('should allow apostrophes in identifiers', () => {
      const lexer = new Lexer("x' y''");
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.IDENTIFIER);
      assertEqual(tokens[0].value, "x'");
      assertEqual(tokens[1].type, TokenType.IDENTIFIER);
      assertEqual(tokens[1].value, "y''");
    });
  });

  describe('Comments', () => {
    test('should skip line comments', () => {
      const lexer = new Lexer('42 -- this is a comment\n5');
      const tokens = lexer.tokenize();
      assertEqual(tokens.length, 4); // 42, NEWLINE, 5, EOF
      assertEqual(tokens[0].value, 42);
      assertEqual(tokens[1].type, TokenType.NEWLINE);
      assertEqual(tokens[2].value, 5);
    });

    test('should skip block comments', () => {
      const lexer = new Lexer('42 {- comment -} 5');
      const tokens = lexer.tokenize();
      assertEqual(tokens.length, 3); // 42, 5, EOF
      assertEqual(tokens[0].value, 42);
      assertEqual(tokens[1].value, 5);
    });

    test('should handle nested block comments', () => {
      const lexer = new Lexer('42 {- outer {- inner -} outer -} 5');
      const tokens = lexer.tokenize();
      assertEqual(tokens.length, 3);
      assertEqual(tokens[0].value, 42);
      assertEqual(tokens[1].value, 5);
    });
  });

  describe('Complex expressions', () => {
    test('should tokenize const with lambda', () => {
      const lexer = new Lexer('const add = \\x -> x');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.CONST);
      assertEqual(tokens[1].type, TokenType.IDENTIFIER);
      assertEqual(tokens[1].value, 'add');
      assertEqual(tokens[2].type, TokenType.EQUALS);
      assertEqual(tokens[3].type, TokenType.LAMBDA);
      assertEqual(tokens[4].type, TokenType.IDENTIFIER);
      assertEqual(tokens[4].value, 'x');
      assertEqual(tokens[5].type, TokenType.ARROW);
      assertEqual(tokens[6].type, TokenType.IDENTIFIER);
      assertEqual(tokens[6].value, 'x');
    });

    test('should tokenize pipeline', () => {
      const lexer = new Lexer('x |> f |> g');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.IDENTIFIER);
      assertEqual(tokens[1].type, TokenType.PIPE);
      assertEqual(tokens[2].type, TokenType.IDENTIFIER);
      assertEqual(tokens[3].type, TokenType.PIPE);
      assertEqual(tokens[4].type, TokenType.IDENTIFIER);
    });

    test('should tokenize lambda', () => {
      const lexer = new Lexer('\\x -> x + 1');
      const tokens = lexer.tokenize();
      assertEqual(tokens[0].type, TokenType.LAMBDA);
      assertEqual(tokens[1].type, TokenType.IDENTIFIER);
      assertEqual(tokens[2].type, TokenType.ARROW);
      assertEqual(tokens[3].type, TokenType.IDENTIFIER);
      assertEqual(tokens[4].type, TokenType.PLUS);
      assertEqual(tokens[5].type, TokenType.INT);
    });
  });

  describe('Error handling', () => {
    test('should throw on unexpected character', () => {
      const lexer = new Lexer('@');
      assertThrows(() => lexer.tokenize(), 'Unexpected character');
    });

    test('should throw on unterminated string', () => {
      const lexer = new Lexer('"hello');
      assertThrows(() => lexer.tokenize(), 'Unterminated string');
    });
  });

  describe('EOF token', () => {
    test('should always end with EOF', () => {
      const lexer = new Lexer('42');
      const tokens = lexer.tokenize();
      assertEqual(tokens[tokens.length - 1].type, TokenType.EOF);
    });

    test('should have EOF on empty input', () => {
      const lexer = new Lexer('');
      const tokens = lexer.tokenize();
      assertEqual(tokens.length, 1);
      assertEqual(tokens[0].type, TokenType.EOF);
    });
  });
});
