// Test utilities for Piper

import { strict as assert } from 'assert';

export function assertThrows(fn: () => void, expectedMessage?: string): void {
  let threw = false;
  let error: Error | undefined;

  try {
    fn();
  } catch (e) {
    threw = true;
    error = e as Error;
  }

  assert(threw, 'Expected function to throw an error');

  if (expectedMessage && error) {
    assert(
      error.message.includes(expectedMessage),
      `Expected error message to include "${expectedMessage}", got "${error.message}"`
    );
  }
}

export function assertDeepEqual(actual: any, expected: any, message?: string): void {
  assert.deepEqual(actual, expected, message);
}

export function assertEqual(actual: any, expected: any, message?: string): void {
  assert.equal(actual, expected, message);
}
