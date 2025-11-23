// AST Node Types for Piper Language

export type Location = {
  line: number;
  column: number;
};

export type SourceSpan = {
  start: Location;
  end: Location;
};

// Base node with location info
export type Node = {
  span?: SourceSpan;
};

// Literals
export type IntLiteral = Node & {
  type: 'IntLiteral';
  value: number;
};

export type FloatLiteral = Node & {
  type: 'FloatLiteral';
  value: number;
};

export type StringLiteral = Node & {
  type: 'StringLiteral';
  value: string;
};

export type BoolLiteral = Node & {
  type: 'BoolLiteral';
  value: boolean;
};

export type UnitLiteral = Node & {
  type: 'UnitLiteral';
};

export type ListLiteral = Node & {
  type: 'ListLiteral';
  elements: Expr[];
};

export type RecordLiteral = Node & {
  type: 'RecordLiteral';
  fields: { name: string; value: Expr }[];
};

export type SpanLiteral = Node & {
  type: 'SpanLiteral';
  elements: Expr[];
};

export type Literal =
  | IntLiteral
  | FloatLiteral
  | StringLiteral
  | BoolLiteral
  | UnitLiteral
  | ListLiteral
  | RecordLiteral
  | SpanLiteral;

// Identifier
export type Identifier = Node & {
  type: 'Identifier';
  name: string;
};

// Lambda: \ param -> body
export type Lambda = Node & {
  type: 'Lambda';
  param: string;
  body: Expr;
};

// Pipeline: lhs |> rhs
export type Pipeline = Node & {
  type: 'Pipeline';
  left: Expr;
  right: Expr;
};

// Stage: fn <| arg1 arg2 ...  (stage-args form)
// Can have one or more arguments
export type Stage = Node & {
  type: 'Stage';
  fn: Expr;
  args: Expr[];
};

// Conditional: if cond then thenBranch else elseBranch
export type Conditional = Node & {
  type: 'Conditional';
  condition: Expr;
  thenBranch: Expr;
  elseBranch: Expr;
};

// Parenthesized expression
export type Parens = Node & {
  type: 'Parens';
  expr: Expr;
};

// Binary operation: left op right
export type BinaryOp = Node & {
  type: 'BinaryOp';
  op: '+' | '-' | '*' | '/' | '%' | '**' | '>' | '<' | '=';
  left: Expr;
  right: Expr;
};

// Unary operation: op expr
export type UnaryOp = Node & {
  type: 'UnaryOp';
  op: '-';
  expr: Expr;
};

// All expression types
export type Expr =
  | Literal
  | Identifier
  | Lambda
  | Pipeline
  | Stage
  | Conditional
  | Parens
  | BinaryOp
  | UnaryOp;

// Top-level declarations
export type UseDecl = Node & {
  type: 'UseDecl';
  path: string;
};

export type ConstDecl = Node & {
  type: 'ConstDecl';
  name: string;
  value: Expr;
};

export type TopLevelPipeline = Node & {
  type: 'TopLevelPipeline';
  expr: Expr;
};

export type Declaration = UseDecl | ConstDecl | TopLevelPipeline;

// Program
export type Program = Node & {
  type: 'Program';
  declarations: Declaration[];
};
