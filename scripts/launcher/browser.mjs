import { spawn } from 'node:child_process';

export function openUrl(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: process.platform === 'win32' }).unref();
}
