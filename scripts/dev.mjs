import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apps = [
  {
    name: "API",
    cwd: resolve(root, "backend"),
    entry: resolve(root, "backend/node_modules/tsx/dist/cli.mjs"),
    args: ["watch", "src/server.mts"],
  },
  {
    name: "Web",
    cwd: resolve(root, "frontend"),
    entry: resolve(root, "frontend/node_modules/vite/bin/vite.js"),
    args: [],
  },
];

function getApiPort() {
  if (process.env.PORT) return process.env.PORT;
  for (const envPath of [
    resolve(root, "backend/.env"),
    resolve(root, ".env"),
  ]) {
    if (!existsSync(envPath)) continue;
    const match = readFileSync(envPath, "utf8").match(
      /^\s*PORT\s*=\s*(?:"([0-9]+)"|'([0-9]+)'|([0-9]+))\s*(?:#.*)?$/m,
    );
    const port = match?.[1] ?? match?.[2] ?? match?.[3];
    if (port) return port;
  }
  return "5000";
}

const apiPort = getApiPort();
let reuseApi = false;
try {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`, {
    signal: AbortSignal.timeout(1000),
  });
  if (response.ok) {
    const body = await response.json();
    reuseApi = body?.success === true && body?.data?.status === "ok";
  }
} catch {
  // Start the local API below when no healthy MediaHub API is listening.
}

if (reuseApi) {
  console.info(`[API] reusing healthy API on port ${apiPort}`);
}

const appsToStart = reuseApi ? apps.filter((app) => app.name !== "API") : apps;

for (const app of appsToStart) {
  if (!existsSync(app.entry)) {
    console.error(
      `${app.name} dependencies are missing. Run npm ci --prefix ${app.name === "API" ? "backend" : "frontend"} first.`,
    );
    process.exit(1);
  }
}

const children = appsToStart.map((app) => {
  console.info(`[${app.name}] starting…`);
  const child = spawn(process.execPath, [app.entry, ...app.args], {
    cwd: app.cwd,
    detached: process.platform !== "win32",
    env: process.env,
    stdio: "inherit",
  });
  child.appName = app.name;
  return child;
});

let stopping = false;
function stopChildTree(child, signal) {
  if (child.exitCode !== null || child.killed || !child.pid) return;
  if (process.platform === "win32") {
    const taskkill = spawn(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true },
    );
    taskkill.unref();
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function stop(exitCode, signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) stopChildTree(child, signal);
}

for (const child of children) {
  child.once("error", (error) => {
    console.error(`[${child.appName}] failed to start: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (stopping) return;
    const status = code ?? (signal ? 1 : 0);
    console.info(`[${child.appName}] stopped (${signal ?? `code ${status}`})`);
    stop(status);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => stop(signal === "SIGINT" ? 130 : 143, signal));
}
