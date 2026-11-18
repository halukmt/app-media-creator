// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { DEFAULT_PORT, parseArgs } from '../../src/cli/args.js';

describe('parseArgs reads the command line of the CLI', () => {
  test('uses the default port and opens the browser when no options are given', () => {
    expect(parseArgs([])).toEqual({ port: DEFAULT_PORT, open: true, help: false, version: false });
  });

  test('takes the port from --port and disables the browser with --no-open', () => {
    expect(parseArgs(['--port', '5000', '--no-open'])).toMatchObject({ port: 5000, open: false });
  });

  test('takes the port from AMC_PORT when no --port flag is given', () => {
    expect(parseArgs([], { AMC_PORT: '6000' }).port).toBe(6000);
  });

  test('rejects an invalid port', () => {
    expect(() => parseArgs(['--port', 'abc'])).toThrow('Invalid port: abc');
  });

  test('rejects an unknown option', () => {
    expect(() => parseArgs(['--colour'])).toThrow('Unknown option: --colour');
  });
});
