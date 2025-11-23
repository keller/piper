// Lexer/Tokenizer for Piper Language

import { Location } from './ast.js';

export enum TokenType {
  // Keywords
  USE = 'USE',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  CONST = 'CONST',

  // Literals
  INT = 'INT',
  FLOAT = 'FLOAT',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',

  // Operators
  PIPE = 'PIPE',         // |> or |
  STAGE = 'STAGE',       // <|
  LAMBDA = 'LAMBDA',     // \
  ARROW = 'ARROW',       // ->
  EQUALS = 'EQUALS',     // =
  PLUS = 'PLUS',         // +
  MINUS = 'MINUS',       // -
  STAR = 'STAR',         // *
  STARSTAR = 'STARSTAR', // **
  SLASH = 'SLASH',       // /
  PERCENT = 'PERCENT',   // %
  GT = 'GT',             // >
  LT = 'LT',             // <

  // Punctuation
  LPAREN = 'LPAREN',     // (
  RPAREN = 'RPAREN',     // )
  LBRACK = 'LBRACK',     // [
  RBRACK = 'RBRACK',     // ]
  LBRACE = 'LBRACE',     // {
  RBRACE = 'RBRACE',     // }
  COMMA = 'COMMA',       // ,
  COLON = 'COLON',       // :
  SPANBRACK = 'SPANBRACK', // #[

  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
}

export type Token = {
  type: TokenType;
  value: string | number | boolean;
  location: Location;
};

const KEYWORDS: Record<string, TokenType> = {
  use: TokenType.USE,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  if: TokenType.IF,
  then: TokenType.THEN,
  else: TokenType.ELSE,
  const: TokenType.CONST,
};

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private nestingDepth: number = 0; // Track nesting for (), [], {}

  constructor(source: string) {
    this.source = source;
  }

  private currentChar(): string | null {
    if (this.pos >= this.source.length) return null;
    return this.source[this.pos];
  }

  private peekChar(offset: number = 1): string | null {
    const pos = this.pos + offset;
    if (pos >= this.source.length) return null;
    return this.source[pos];
  }

  private advance(): void {
    if (this.pos < this.source.length) {
      if (this.source[this.pos] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }
  }

  private skipWhitespace(): void {
    while (this.currentChar() && /\s/.test(this.currentChar()!) && this.currentChar() !== '\n') {
      this.advance();
    }
  }

  private skipWhitespaceIncludingNewlines(): void {
    while (this.currentChar() && /\s/.test(this.currentChar()!)) {
      this.advance();
    }
  }

  private skipLineComment(): void {
    // Skip --
    this.advance();
    this.advance();
    // Skip until end of line
    while (this.currentChar() && this.currentChar() !== '\n') {
      this.advance();
    }
  }

  private skipBlockComment(): void {
    // Skip {-
    this.advance();
    this.advance();

    let depth = 1;
    while (depth > 0 && this.currentChar()) {
      if (this.currentChar() === '{' && this.peekChar() === '-') {
        depth++;
        this.advance();
        this.advance();
      } else if (this.currentChar() === '-' && this.peekChar() === '}') {
        depth--;
        this.advance();
        this.advance();
      } else {
        this.advance();
      }
    }
  }

  private readString(): string {
    let value = '';
    this.advance(); // skip opening "

    while (this.currentChar() && this.currentChar() !== '"') {
      if (this.currentChar() === '\\') {
        this.advance();
        const escapeChar = this.currentChar();
        switch (escapeChar) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          default:
            value += escapeChar;
        }
        this.advance();
      } else {
        value += this.currentChar();
        this.advance();
      }
    }

    if (this.currentChar() === '"') {
      this.advance(); // skip closing "
    } else {
      throw new Error(`Unterminated string at line ${this.line}, column ${this.column}`);
    }

    return value;
  }

  private readNumber(): Token {
    const startLocation: Location = { line: this.line, column: this.column };
    let value = '';
    let isFloat = false;

    while (this.currentChar() && /[0-9]/.test(this.currentChar()!)) {
      value += this.currentChar();
      this.advance();
    }

    if (this.currentChar() === '.' && this.peekChar() && /[0-9]/.test(this.peekChar()!)) {
      isFloat = true;
      value += '.';
      this.advance();

      while (this.currentChar() && /[0-9]/.test(this.currentChar()!)) {
        value += this.currentChar();
        this.advance();
      }
    }

    return {
      type: isFloat ? TokenType.FLOAT : TokenType.INT,
      value: isFloat ? parseFloat(value) : parseInt(value, 10),
      location: startLocation,
    };
  }

  private readIdentifier(): Token {
    const startLocation: Location = { line: this.line, column: this.column };
    let value = '';

    while (
      this.currentChar() &&
      /[a-zA-Z0-9_']/.test(this.currentChar()!)
    ) {
      value += this.currentChar();
      this.advance();
    }

    const tokenType = KEYWORDS[value] || TokenType.IDENTIFIER;
    let tokenValue: string | boolean = value;

    if (tokenType === TokenType.TRUE) {
      tokenValue = true;
    } else if (tokenType === TokenType.FALSE) {
      tokenValue = false;
    }

    return {
      type: tokenType,
      value: tokenValue,
      location: startLocation,
    };
  }

  public nextToken(): Token {
    while (this.currentChar()) {
      const location: Location = { line: this.line, column: this.column };

      // Handle newlines specially
      if (this.currentChar() === '\n') {
        this.advance();
        // Emit NEWLINE token only at nesting depth 0 (top level)
        if (this.nestingDepth === 0) {
          return { type: TokenType.NEWLINE, value: '\n', location };
        }
        // Otherwise skip it
        continue;
      }

      // Skip other whitespace (but not newlines, handled above)
      if (/\s/.test(this.currentChar()!)) {
        this.skipWhitespace();
        continue;
      }

      // Skip comments
      if (this.currentChar() === '-' && this.peekChar() === '-') {
        this.skipLineComment();
        continue;
      }

      if (this.currentChar() === '{' && this.peekChar() === '-') {
        this.skipBlockComment();
        continue;
      }

      // String
      if (this.currentChar() === '"') {
        const value = this.readString();
        return { type: TokenType.STRING, value, location };
      }

      // Number
      if (/[0-9]/.test(this.currentChar()!)) {
        return this.readNumber();
      }

      // Identifier or keyword
      if (/[a-zA-Z_]/.test(this.currentChar()!)) {
        return this.readIdentifier();
      }

      // Two-character operators
      if (this.currentChar() === '|' && this.peekChar() === '>') {
        this.advance();
        this.advance();
        return { type: TokenType.PIPE, value: '|>', location };
      }

      if (this.currentChar() === '<' && this.peekChar() === '|') {
        this.advance();
        this.advance();
        return { type: TokenType.STAGE, value: '<|', location };
      }

      if (this.currentChar() === '-' && this.peekChar() === '>') {
        this.advance();
        this.advance();
        return { type: TokenType.ARROW, value: '->', location };
      }

      if (this.currentChar() === '*' && this.peekChar() === '*') {
        this.advance();
        this.advance();
        return { type: TokenType.STARSTAR, value: '**', location };
      }

      if (this.currentChar() === '#' && this.peekChar() === '[') {
        this.advance();
        this.advance();
        this.nestingDepth++;
        return { type: TokenType.SPANBRACK, value: '#[', location };
      }

      // Single-character tokens
      const char = this.currentChar()!;
      this.advance();

      switch (char) {
        case '|':
          return { type: TokenType.PIPE, value: '|', location };
        case '\\':
          return { type: TokenType.LAMBDA, value: '\\', location };
        case '=':
          return { type: TokenType.EQUALS, value: '=', location };
        case '+':
          return { type: TokenType.PLUS, value: '+', location };
        case '-':
          return { type: TokenType.MINUS, value: '-', location };
        case '*':
          return { type: TokenType.STAR, value: '*', location };
        case '/':
          return { type: TokenType.SLASH, value: '/', location };
        case '%':
          return { type: TokenType.PERCENT, value: '%', location };
        case '>':
          return { type: TokenType.GT, value: '>', location };
        case '<':
          return { type: TokenType.LT, value: '<', location };
        case '(':
          this.nestingDepth++;
          return { type: TokenType.LPAREN, value: '(', location };
        case ')':
          this.nestingDepth--;
          return { type: TokenType.RPAREN, value: ')', location };
        case '[':
          this.nestingDepth++;
          return { type: TokenType.LBRACK, value: '[', location };
        case ']':
          this.nestingDepth--;
          return { type: TokenType.RBRACK, value: ']', location };
        case '{':
          this.nestingDepth++;
          return { type: TokenType.LBRACE, value: '{', location };
        case '}':
          this.nestingDepth--;
          return { type: TokenType.RBRACE, value: '}', location };
        case ',':
          return { type: TokenType.COMMA, value: ',', location };
        case ':':
          return { type: TokenType.COLON, value: ':', location };
        default:
          throw new Error(
            `Unexpected character '${char}' at line ${location.line}, column ${location.column}`
          );
      }
    }

    return {
      type: TokenType.EOF,
      value: '',
      location: { line: this.line, column: this.column },
    };
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();

    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = this.nextToken();
    }

    tokens.push(token); // Add EOF token
    return tokens;
  }
}
