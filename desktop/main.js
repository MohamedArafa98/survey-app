// Electron main process for the Survey App.
// Spawns the FastAPI backend as a child process using a bundled embeddable
// Python distribution, waits for the server to come up, then opens a window
// pointed at http://127.0.0.1:{port}/.

const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const DEV = process.env.SURVEYAPP_DEV === '1';
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 820;
const READY_TIMEOUT_MS = 15_000;

let mainWindow = null;
let pythonProc = null;

function resolvePythonExe() {
  // Dev: desktop/python-runtime/python.exe (populated by scripts/fetch-python.ps1)
  // Packaged: resources/python-runtime/python.exe
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'python-runtime')
    : path.join(__dirname, 'python-runtime');
  const exe = path.join(base, 'python.exe');
  if (!fs.existsSync(exe)) {
    throw new Error(
      `Python runtime not found at ${exe}. Run desktop/scripts/fetch-python.ps1 first.`,
    );
  }
  return exe;
}

function resolveBackendDir() {
  // Dev: ../backend (sibling of desktop/)
  // Packaged: resources/backend
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend');
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/', timeout: 500 },
        (res) => {
          res.resume();
          resolve();
        },
      );
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Backend did not respond within ${timeoutMs}ms`));
        } else {
          setTimeout(tryOnce, 150);
        }
      });
      req.on('timeout', () => req.destroy());
    };
    tryOnce();
  });
}

async function startBackend() {
  const pythonExe = resolvePythonExe();
  const backendDir = resolveBackendDir();
  const port = await pickFreePort();

  const env = {
    ...process.env,
    PYTHONPATH: backendDir,
    PYTHONUNBUFFERED: '1',
  };

  pythonProc = spawn(
    pythonExe,
    [
      '-m',
      'uvicorn',
      'app.main:app',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--log-level',
      'warning',
      '--no-access-log',
    ],
    { cwd: backendDir, env, windowsHide: true },
  );

  pythonProc.stdout.on('data', (d) => process.stdout.write(`[py] ${d}`));
  pythonProc.stderr.on('data', (d) => process.stderr.write(`[py] ${d}`));
  pythonProc.on('exit', (code, signal) => {
    pythonProc = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.error(`Python backend exited (code=${code}, signal=${signal})`);
    }
  });

  await waitForServer(port, READY_TIMEOUT_MS);
  return port;
}

function stopBackend() {
  if (pythonProc && !pythonProc.killed) {
    try {
      pythonProc.kill();
    } catch (_) {}
    pythonProc = null;
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    title: 'Survey App',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });

  mainWindow.loadURL(url);
}

app.whenReady().then(async () => {
  try {
    if (DEV) {
      const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173';
      createWindow(devUrl);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      const port = await startBackend();
      createWindow(`http://127.0.0.1:${port}/`);
    }
  } catch (err) {
    console.error('Failed to start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopBackend);
app.on('will-quit', stopBackend);
process.on('exit', stopBackend);
