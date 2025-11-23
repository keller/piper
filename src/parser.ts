// Parser for Piper Language

import { Token, TokenType } from './lexer.js';
import * as AST from './ast.js';

export class ParseError extends Error {
  constructor(
    message: string,
    public location?: AST.Location
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private peek(offset: number = 1): Token {
    const pos = this.pos + offset;
    if (pos >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // EOF
    }
    return this.tokens[pos];
  }

  private advance(): Token {
    const token = this.current();
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(
        `Expected ${type} but got ${token.type}`,
        token.location
      );
    }
    return this.advance();
  }

  private match(...types: TokenType[]): boolean {
    return types.includes(this.current().type);
  }

  // Skip any NEWLINE tokens
  private skipNewlines(): void {
    while (this.current().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  // Program ::= Declaration*
  public parseProgram(): AST.Program {
    const declarations: AST.Declaration[] = [];

    this.skipNewlines(); // Skip leading newlines
    while (!this.match(TokenType.EOF)) {
      declarations.push(this.parseDeclaration());
      this.skipNewlines(); // Skip newlines between declarations
    }

    return {
      type: 'Program',
      declarations,
    };
  }

  // Declaration ::= UseDecl | ConstDecl | TopLevelPipeline
  private parseDeclaration(): AST.Declaration {
    if (this.match(TokenType.USE)) {
      return this.parseUseDecl();
    }

    if (this.match(TokenType.CONST)) {
      return this.parseConstDecl();
    }

    // Top-level pipeline: starts with |> and implicitly uses Unit
    if (this.match(TokenType.PIPE)) {
      this.advance(); // consume the pipe
      const stages = this.parsePipelineStages();
      // Build pipeline starting with Unit
      let expr: AST.Expr = { type: 'UnitLiteral' };
      for (const stage of stages) {
        expr = {
          type: 'Pipeline',
          left: expr,
          right: stage,
        };
      }
      return {
        type: 'TopLevelPipeline',
        expr,
      };
    }

    // Otherwise, it's just an expression statement
    const expr = this.parseExpression();
    return {
      type: 'TopLevelPipeline',
      expr,
    };
  }

  // Helper to parse a sequence of stages after initial pipe
  private parsePipelineStages(): AST.Expr[] {
    const stages: AST.Expr[] = [];
    stages.push(this.parseStage());

    while (this.match(TokenType.PIPE)) {
      this.advance();
      stages.push(this.parseStage());
    }

    return stages;
  }

  // UseDecl ::= use STRING
  private parseUseDecl(): AST.UseDecl {
    this.expect(TokenType.USE);
    const pathToken = this.expect(TokenType.STRING);

    return {
      type: 'UseDecl',
      path: pathToken.value as string,
    };
  }

  // ConstDecl ::= const IDENTIFIER = Expr
  private parseConstDecl(): AST.ConstDecl {
    this.expect(TokenType.CONST);
    const nameToken = this.expect(TokenType.IDENTIFIER);
    this.expect(TokenType.EQUALS);
    this.skipNewlines(); // Allow newlines after =
    const value = this.parseExpression();

    return {
      type: 'ConstDecl',
      name: nameToken.value as string,
      value,
    };
  }

  // Expression parsing with precedence
  private parseExpression(): AST.Expr {
    return this.parsePipeline();
  }

  // Pipeline ::= Stage (|> Stage)*
  // Left-associative: a |> b |> c = (a |> b) |> c
  // Allows newlines before |> for multi-line pipelines
  private parsePipeline(): AST.Expr {
    let left = this.parseStage();

    this.skipNewlines(); // Allow newlines before continuation |>
    while (this.match(TokenType.PIPE)) {
      this.advance();
      this.skipNewlines(); // Allow newlines after |>
      const right = this.parseStage();
      left = {
        type: 'Pipeline',
        left,
        right,
      };
      this.skipNewlines(); // Allow newlines before next |>
    }

    return left;
  }

  // Stage ::= Conditional (<| StageArgs)?
  // StageArgs: collect space-separated conditionals/primaries until NEWLINE/pipe/etc
  // For right-associativity (a <| b <| c), recursively parse stages
  private parseStage(): AST.Expr {
    let fn = this.parseConditional();

    if (this.match(TokenType.STAGE)) {
      this.advance();
      const args = this.parseStageArgs();
      return {
        type: 'Stage',
        fn,
        args,
      };
    }

    return fn;
  }

  // Parse stage arguments: space-separated expressions until statement boundary
  // Handles right-associativity: a <| b <| c parses b <| c as a single arg
  private parseStageArgs(): AST.Expr[] {
    const args: AST.Expr[] = [];

    while (true) {
      // Stop at statement/expression boundaries
      if (this.match(
        TokenType.NEWLINE,
        TokenType.PIPE,
        TokenType.EOF,
        TokenType.RPAREN,
        TokenType.RBRACK,
        TokenType.RBRACE,
        TokenType.COMMA,
        TokenType.THEN,
        TokenType.ELSE,
        TokenType.CONST,
        TokenType.USE
      )) {
        break;
      }

      // Parse one argument
      // For right-associativity, we need to check if this arg is followed by <|
      // If so, we parse it plus the <| as a single Stage expression
      const arg = this.parseConditional();

      // If followed by <|, create a nested stage
      if (this.match(TokenType.STAGE)) {
        this.advance(); // consume <|
        const nestedArgs = this.parseStageArgs(); // Recursive!
        const nestedStage: AST.Stage = {
          type: 'Stage',
          fn: arg,
          args: nestedArgs,
        };
        args.push(nestedStage);
        break; // nestedArgs consumed the rest
      } else {
        args.push(arg);
      }
    }

    if (args.length === 0) {
      throw new ParseError('Stage operator <| requires at least one argument');
    }

    return args;
  }

  // Helper to check if we can parse a primary expression
  private canParsePrimary(): boolean {
    return this.match(
      TokenType.INT,
      TokenType.FLOAT,
      TokenType.STRING,
      TokenType.TRUE,
      TokenType.FALSE,
      TokenType.IDENTIFIER,
      TokenType.LAMBDA,
      TokenType.LPAREN,
      TokenType.LBRACK,
      TokenType.SPANBRACK,
      TokenType.LBRACE,
      TokenType.MINUS
    );
  }

  // Conditional ::= if Expr then Expr else Expr | Lambda
  private parseConditional(): AST.Expr {
    if (this.match(TokenType.IF)) {
      this.advance();
      this.skipNewlines(); // Allow newlines after if
      const condition = this.parseExpression();
      this.skipNewlines(); // Allow newlines before then
      this.expect(TokenType.THEN);
      this.skipNewlines(); // Allow newlines after then
      const thenBranch = this.parseExpression();
      this.skipNewlines(); // Allow newlines before else
      this.expect(TokenType.ELSE);
      this.skipNewlines(); // Allow newlines after else
      const elseBranch = this.parseExpression();

      return {
        type: 'Conditional',
        condition,
        thenBranch,
        elseBranch,
      };
    }

    return this.parseLambda();
  }

  // Lambda ::= \ IDENTIFIER -> Expr | Comparison
  private parseLambda(): AST.Expr {
    if (this.match(TokenType.LAMBDA)) {
      this.advance();
      const paramToken = this.expect(TokenType.IDENTIFIER);
      this.expect(TokenType.ARROW);
      this.skipNewlines(); // Allow newlines after -> in lambdas
      const body = this.parseExpression();

      return {
        type: 'Lambda',
        param: paramToken.value as string,
        body,
      };
    }

    return this.parseComparison();
  }

  // Comparison ::= Additive ((> | < | =) Additive)*
  // Left-associative: a > b > c = (a > b) > c
  private parseComparison(): AST.Expr {
    let left = this.parseAdditive();

    while (this.match(TokenType.GT, TokenType.LT, TokenType.EQUALS)) {
      const opToken = this.advance();
      const right = this.parseAdditive();
      left = {
        type: 'BinaryOp',
        op: opToken.value as '>' | '<' | '=',
        left,
        right,
      };
    }

    return left;
  }

  // Additive ::= Multiplicative ((+ | -) Multiplicative)*
  // Left-associative: a + b + c = (a + b) + c
  private parseAdditive(): AST.Expr {
    let left = this.parseMultiplicative();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const opToken = this.advance();
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryOp',
        op: opToken.value as '+' | '-',
        left,
        right,
      };
    }

    return left;
  }

  // Multiplicative ::= Unary ((* | / | %) Unary)*
  // Left-associative: a * b * c = (a * b) * c
  private parseMultiplicative(): AST.Expr {
    let left = this.parseUnary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const opToken = this.advance();
      const right = this.parseUnary();
      left = {
        type: 'BinaryOp',
        op: opToken.value as '*' | '/' | '%',
        left,
        right,
      };
    }

    return left;
  }

  // Unary ::= - Unary | Exponentiation
  private parseUnary(): AST.Expr {
    if (this.match(TokenType.MINUS)) {
      this.advance();
      const expr = this.parseUnary(); // Right-associative
      return {
        type: 'UnaryOp',
        op: '-',
        expr,
      };
    }

    return this.parseExponentiation();
  }

  // Exponentiation ::= Primary (** Exponentiation)?
  // Right-associative: a ** b ** c = a ** (b ** c)
  private parseExponentiation(): AST.Expr {
    const left = this.parsePrimary();

    if (this.match(TokenType.STARSTAR)) {
      this.advance();
      const right = this.parseExponentiation(); // Right-associative recursion
      return {
        type: 'BinaryOp',
        op: '**',
        left,
        right,
      };
    }

    return left;
  }

  // Primary ::= Literal | IDENTIFIER | ( Expr ) | [ List ] | { Record }
  private parsePrimary(): AST.Expr {
    // Literals
    if (this.match(TokenType.INT)) {
      const token = this.advance();
      return {
        type: 'IntLiteral',
        value: token.value as number,
      };
    }

    if (this.match(TokenType.FLOAT)) {
      const token = this.advance();
      return {
        type: 'FloatLiteral',
        value: token.value as number,
      };
    }

    if (this.match(TokenType.STRING)) {
      const token = this.advance();
      return {
        type: 'StringLiteral',
        value: token.value as string,
      };
    }

    if (this.match(TokenType.TRUE, TokenType.FALSE)) {
      const token = this.advance();
      return {
        type: 'BoolLiteral',
        value: token.value as boolean,
      };
    }

    // Unit literal: ()
    if (this.match(TokenType.LPAREN)) {
      const startToken = this.advance();

      // Check for Unit literal
      if (this.match(TokenType.RPAREN)) {
        this.advance();
        return {
          type: 'UnitLiteral',
        };
      }

      // Otherwise, it's a parenthesized expression
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return {
        type: 'Parens',
        expr,
      };
    }

    // List literal: [e1, e2, ...]
    if (this.match(TokenType.LBRACK)) {
      return this.parseListLiteral();
    }

    // Span literal: #[e1, e2, ...]
    if (this.match(TokenType.SPANBRACK)) {
      return this.parseSpanLiteral();
    }

    // Record literal: {name: value, ...}
    if (this.match(TokenType.LBRACE)) {
      return this.parseRecordLiteral();
    }

    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      const token = this.advance();
      return {
        type: 'Identifier',
        name: token.value as string,
      };
    }

    const token = this.current();
    throw new ParseError(
      `Unexpected token: ${token.type} (${token.value})`,
      token.location
    );
  }

  // ListLiteral ::= [ (Expr Expr*)? ]
  private parseListLiteral(): AST.ListLiteral {
    this.expect(TokenType.LBRACK);
    const elements: AST.Expr[] = [];

    while (!this.match(TokenType.RBRACK)) {
      // Parse at conditional level (like stage args) to avoid consuming separators
      elements.push(this.parseConditional());
    }

    this.expect(TokenType.RBRACK);

    return {
      type: 'ListLiteral',
      elements,
    };
  }

  // SpanLiteral ::= #[ (Expr Expr*)? ]
  private parseSpanLiteral(): AST.SpanLiteral {
    this.expect(TokenType.SPANBRACK);
    const elements: AST.Expr[] = [];

    while (!this.match(TokenType.RBRACK)) {
      // Parse at conditional level (like stage args) to avoid consuming separators
      elements.push(this.parseConditional());
    }

    this.expect(TokenType.RBRACK);

    return {
      type: 'SpanLiteral',
      elements,
    };
  }

  // RecordLiteral ::= { (IDENTIFIER = Expr)* }
  private parseRecordLiteral(): AST.RecordLiteral {
    this.expect(TokenType.LBRACE);
    const fields: { name: string; value: AST.Expr }[] = [];

    while (this.match(TokenType.IDENTIFIER)) {
      const nameToken = this.advance();
      this.expect(TokenType.EQUALS);
      const value = this.parseConditional();
      fields.push({ name: nameToken.value as string, value });
    }

    this.expect(TokenType.RBRACE);

    return {
      type: 'RecordLiteral',
      fields,
    };
  }
}
