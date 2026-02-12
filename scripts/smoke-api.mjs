#!/usr/bin/env node

const args = process.argv.slice(2);

function readArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

const base =
  readArgValue("--base") ||
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

const token = readArgValue("--token") || process.env.TOKEN || "";
const strict = hasFlag("--strict");

if (!base) {
  console.error(
    "Missing API base URL. Provide --base http://localhost:3001 or set API_BASE_URL / NEXT_PUBLIC_API_URL"
  );
  process.exit(2);
}

const normalizedBase = base.replace(/\/+$/, "");

const endpoints = [
  // System Settings (GET)
  { method: "GET", path: "/api/roles" },
  { method: "GET", path: "/api/employees" },
  { method: "GET", path: "/api/approval-workflows" },
  { method: "GET", path: "/api/global-parameters" },
  { method: "GET", path: "/api/kanban-parameters" },
  { method: "GET", path: "/api/machine-parameters" },
  { method: "GET", path: "/api/process-parameters" },
  { method: "GET", path: "/api/uom-parameters" },
  { method: "GET", path: "/api/type-parameters" },
  { method: "GET", path: "/api/safety-stock" },
  { method: "GET", path: "/api/stockdays" },
  { method: "GET", path: "/api/po-split-settings" },
  { method: "GET", path: "/api/access-control" },

  // Inventory (GET list)
  { method: "GET", path: "/api/finished-good/?page=1&perPage=10" },
  { method: "GET", path: "/api/work-in-progress/?page=1&perPage=10" },
  { method: "GET", path: "/api/rm-inventory?page=1&perPage=10" }
];

function padRight(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function formatStatus(status) {
  if (status == null) return "ERR";
  return String(status);
}

async function run() {
  const headers = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  console.log(`Base: ${normalizedBase}`);
  console.log(`Auth: ${token ? "Bearer <provided>" : "(none)"}`);
  console.log("");

  let failures = 0;

  for (const e of endpoints) {
    const url = normalizedBase + e.path;

    let status = null;
    let ok = false;
    let note = "";

    try {
      const res = await fetch(url, {
        method: e.method,
        headers,
      });

      status = res.status;
      ok = res.ok;

      if (status === 401 || status === 403) {
        note = "(auth)";
      } else if (status === 404) {
        note = "(missing route?)";
      } else if (status >= 500) {
        note = "(server error)";
      }

      // Consume body to avoid keeping sockets open; ignore parsing errors
      await res.text().catch(() => "");
    } catch (err) {
      failures += 1;
      note = "(network error)";
    }

    const line =
      `${padRight(formatStatus(status), 4)} ` +
      `${padRight(e.method, 6)} ` +
      `${url} ${note}`;

    console.log(line);

    if (!ok) failures += 1;
  }

  console.log("");

  if (failures === 0) {
    console.log("OK: all endpoints returned 2xx/3xx");
    process.exit(0);
  }

  const msg = strict
    ? `FAIL: ${failures} request(s) not OK`
    : `DONE: ${failures} request(s) not OK (run with --strict to fail CI)`;

  console.log(msg);
  process.exit(strict ? 1 : 0);
}

run();
