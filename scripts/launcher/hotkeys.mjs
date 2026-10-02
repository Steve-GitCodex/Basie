import readline from 'node:readline';

export function startHotkeys({ onKey, input = process.stdin, output = process.stdout }) {
  if (!input.isTTY) return null;
  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  let prompting = false;

  const onKeypress = (str, key) => {
    if (prompting) return;
    if (key?.ctrl && key.name === 'c') return onKey('q');
    if (str) onKey(str.toLowerCase());
  };
  input.on('keypress', onKeypress);

  return {
    prompt(question) {
      prompting = true;
      input.setRawMode(false);
      const rl = readline.createInterface({ input, output, terminal: true });
      return new Promise((resolve) => {
        let settled = false;
        const finish = (answer) => {
          if (settled) return;
          settled = true;
          rl.close();
          input.setRawMode(true);
          input.resume();
          prompting = false;
          resolve(answer.trim());
        };
        rl.on('SIGINT', () => finish(''));
        rl.on('close', () => finish(''));
        rl.question(question, finish);
      });
    },
    close() {
      input.off('keypress', onKeypress);
      input.setRawMode(false);
      input.pause();
    },
  };
}
