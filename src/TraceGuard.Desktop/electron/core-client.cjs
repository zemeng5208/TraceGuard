const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

class CoreClient extends EventEmitter {
  constructor({ app, isDev }) {
    super();
    this.app = app;
    this.isDev = isDev;
    this.process = null;
    this.pending = new Map();
    this.sequence = 0;
    this.unavailableReason = 'TraceGuard Core has not started.';
  }

  start() {
    if (process.platform !== 'win32') {
      this.unavailableReason = 'TraceGuard Core runs on Windows 10 or Windows 11 only.';
      return;
    }
    const executable = this.app.isPackaged
      ? path.join(process.resourcesPath, 'core', 'TraceGuard.Core.exe')
      : 'dotnet';
    const args = this.app.isPackaged
      ? []
      : ['run', '--project', path.join(this.app.getAppPath(), 'src', 'TraceGuard.Core', 'TraceGuard.Core.csproj'), '--no-launch-profile'];
    try {
      this.process = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = readline.createInterface({ input: this.process.stdout });
      lines.on('line', (line) => this.handleLine(line));
      this.process.stderr.on('data', (chunk) => this.emit('diagnostic', chunk.toString()));
      this.process.on('error', (error) => {
        this.unavailableReason = error.message;
        this.rejectAll(error);
      });
      this.process.on('exit', (code) => {
        this.unavailableReason = `TraceGuard Core exited with code ${code ?? 'unknown'}.`;
        this.rejectAll(new Error(this.unavailableReason));
        this.process = null;
      });
    } catch (error) {
      this.unavailableReason = error instanceof Error ? error.message : String(error);
    }
  }

  handleLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.event === 'traceEvent') {
      this.emit('traceEvent', message.data);
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.result);
  }

  request(method, params = {}) {
    if (!this.process?.stdin?.writable) return Promise.reject(new Error(this.unavailableReason));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`TraceGuard Core timed out while handling ${method}.`));
      }, 12000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); },
      });
      this.process.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  stop() {
    if (this.process && !this.process.killed) this.process.kill();
  }
}

module.exports = { CoreClient };
