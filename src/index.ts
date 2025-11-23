// Main entry point for Piper Language

export * from './ast.js';
export * from './lexer.js';
export * from './parser.js';
export * from './interpreter.js';
export * from './compiler.js';

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Interpreter } from './interpreter.js';
import { Compiler } from './compiler.js';
import type { Program } from './ast.js';

export function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

export function interpret(source: string): void {
  const program = parse(source);
  const interpreter = new Interpreter();
  interpreter.run(program);
}

export function compile(source: string): string {
  const program = parse(source);
  const compiler = new Compiler();
  return compiler.compile(program);
}

// Deprecated alias for backwards compatibility
export const transpile = compile;
