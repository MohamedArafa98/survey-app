// Preload runs in an isolated context before the renderer loads.
// Intentionally empty: the app reaches the backend via fetch on the same
// http://127.0.0.1:{port} origin the window is loaded from, so no IPC bridge
// is needed today. Keep this file so contextIsolation has a preload target.
