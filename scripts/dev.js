const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const viteBin = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const electronBin = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

let rendererProcess;
let electronProcess;
let shuttingDown = false;
const defaultPort = Number(process.env.VITE_DEV_PORT || 5173);

function quoteWindowsArgument(value) {
  if (!value) {
    return '""';
  }

  if (!/[ \t"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

function spawnLocalBin(command, args, extraOptions = {}) {
  if (process.platform === 'win32') {
    const shellCommand = [quoteWindowsArgument(command), ...args.map(quoteWindowsArgument)].join(' ');
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', shellCommand], {
      cwd: rootDir,
      stdio: 'inherit',
      ...extraOptions
    });
  }

  return spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...extraOptions
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    function attempt() {
      const socket = new net.Socket();
      socket
        .setTimeout(1000)
        .once('connect', () => {
          socket.destroy();
          resolve();
        })
        .once('timeout', () => socket.destroy())
        .once('error', () => socket.destroy())
        .once('close', () => {
          if (Date.now() - start >= timeoutMs) {
            reject(new Error(`Timed out waiting for port ${port}`));
            return;
          }

          setTimeout(attempt, 300);
        })
        .connect(port, host);
    }

    attempt();
  });
}

function findAvailablePort(startPort, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = net.createServer();
      server.unref();
      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          tryPort(port + 1);
          return;
        }

        reject(error);
      });

      server.listen(port, host, () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    }

    tryPort(startPort);
  });
}

function terminateChildren(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }

  if (rendererProcess && !rendererProcess.killed) {
    rendererProcess.kill();
  }

  setTimeout(() => process.exit(code), 50);
}

findAvailablePort(defaultPort)
  .then((port) => {
    const devServerUrl = `http://127.0.0.1:${port}`;

    rendererProcess = spawnLocalBin(viteBin, ['--host', '127.0.0.1', '--port', String(port), '--strictPort']);

    rendererProcess.on('exit', (code) => {
      if (!shuttingDown) {
        terminateChildren(code ?? 1);
      }
    });

    return waitForPort(port).then(() => {
      electronProcess = spawnLocalBin(electronBin, ['.'], {
        env: {
          ...process.env,
          VITE_DEV_SERVER_URL: devServerUrl
        }
      });

      electronProcess.on('exit', (code) => terminateChildren(code ?? 0));
    });
  })
  .catch((error) => {
    console.error(error.message);
    terminateChildren(1);
  });

process.on('SIGINT', () => terminateChildren(0));
process.on('SIGTERM', () => terminateChildren(0));
