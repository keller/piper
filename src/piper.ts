#!/usr/bin/env node

// CLI for Piper Language

import { readFileSync } from 'fs';
import { parse, interpret, compile } from './index.js';

function printUsage(): void {
  console.log(`
Piper Language CLI

Usage:
  piper <command> <file>

Commands:
  run <file>        Run a Piper program using the interpreter
  compile <file>    Compile Piper to JavaScript
  parse <file>      Parse and print the AST
  help              Show this help message

Examples:
  piper run program.piper
  piper compile program.piper > output.js
  piper parse program.piper
`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const filename = args[1];

  if (!filename) {
    console.error('Error: No input file specified');
    printUsage();
    process.exit(1);
  }

  let source: string;
  try {
    source = readFileSync(filename, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${err}`);
    process.exit(1);
  }

  try {
    switch (command) {
      case 'run':
        interpret(source);
        break;

      case 'compile':
        const jsCode = compile(source);
        console.log(jsCode);
        break;

      case 'parse':
        const ast = parse(source);
        console.log(JSON.stringify(ast, null, 2));
        break;

      default:
        console.error(`Error: Unknown command '${command}'`);
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err}`);
    process.exit(1);
  }
}

main();
