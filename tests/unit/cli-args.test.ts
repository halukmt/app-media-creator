// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { DEFAULT_PORT, DEFAULT_WORKSPACE, parseArgs } from '../../src/cli/args.js';

describe('parseArgs reads the command line of the CLI', () => {
  test('uses the default port, workspace and opens the browser when no options are given', () => {
    expect(parseArgs([])).toEqual({
      port: DEFAULT_PORT,
      open: true,
      help: false,
      version: false,
      workspace: DEFAULT_WORKSPACE,
    });
  });

  test('takes the workspace folder from --workspace or -w', () => {
    expect(parseArgs(['--workspace', 'media']).workspace).toBe('media');
    expect(parseArgs(['-w', '../shared']).workspace).toBe('../shared');
  });

  test('rejects --workspace without a folder', () => {
    expect(() => parseArgs(['--workspace'])).toThrow('--workspace needs a folder');
    expect(() => parseArgs(['-w', '--no-open'])).toThrow('-w needs a folder');
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
