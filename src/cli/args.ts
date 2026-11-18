import { DEFAULT_WORKSPACE_DIR } from '../core/workspace/workspace.js';

export interface CliOptions {
  port: number;
  open: boolean;
  help: boolean;
  version: boolean;
  /** Workspace folder, relative to the current directory or absolute. */
  workspace: string;
}

export const DEFAULT_PORT = 4790;
export const DEFAULT_WORKSPACE = DEFAULT_WORKSPACE_DIR;

/** Parses command-line arguments. Throws on unknown flags or an invalid port. */
export function parseArgs(argv: readonly string[], env: Record<string, string | undefined> = {}): CliOptions {
  const options: CliOptions = {
    port: env.AMC_PORT ? parsePort(env.AMC_PORT) : DEFAULT_PORT,
    open: true,
    help: false,
    version: false,
    workspace: DEFAULT_WORKSPACE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--port':
      case '-p': {
        const value = argv[i + 1];
        if (value === undefined) throw new Error(`${arg} needs a value`);
        options.port = parsePort(value);
        i += 1;
        break;
      }
      case '--workspace':
      case '-w': {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('-')) throw new Error(`${arg} needs a folder`);
        options.workspace = value;
        i += 1;
        break;
      }
      case '--no-open':
        options.open = false;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

export const HELP_TEXT = `Usage: app-media-creator [options]

Starts the local app-media-creator UI in your browser.

Options:
  -p, --port <number>    Port of the local server (default ${DEFAULT_PORT}, or AMC_PORT)
  -w, --workspace <dir>  Workspace folder for settings, inputs and output (default ${DEFAULT_WORKSPACE})
      --no-open          Do not open the browser
  -v, --version          Print the version
  -h, --help             Print this help
`;
