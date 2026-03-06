"use client";

import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";
import { Button, Card, Input, Table, Tag, Typography } from "antd";
import React, { useMemo, useState } from "react";

type Row = {
  key: string;
  method: string;
  path: string;
  status?: number;
  ok?: boolean;
  note?: string;
  tookMs?: number;
};

const { Title, Paragraph, Text } = Typography;

const DEFAULT_ENDPOINTS: Array<{ method: string; path: string; requiresAuth?: boolean }> = [
  { method: "GET", path: "/api/roles", requiresAuth: true },
  { method: "GET", path: "/api/employees", requiresAuth: true },

  { method: "GET", path: "/api/uom-parameters", requiresAuth: true },
  { method: "GET", path: "/api/type-parameters", requiresAuth: true },
  { method: "GET", path: "/api/stockdays", requiresAuth: true },

  { method: "GET", path: "/api/finished-good?page=1&perPage=5", requiresAuth: true },
  { method: "GET", path: "/api/work-in-progress?page=1&perPage=5", requiresAuth: true },
  { method: "GET", path: "/api/rm-inventory?page=1&perPage=5", requiresAuth: true },

  { method: "GET", path: "/api/bom", requiresAuth: true },
  { method: "GET", path: "/api/bom/assembly-codes", requiresAuth: true },

  { method: "GET", path: "/api/scrap-stock?page=1&perPage=5", requiresAuth: true },
  { method: "GET", path: "/api/outgoing-raw-material?page=1&perPage=5", requiresAuth: true },
  { method: "GET", path: "/api/indirect-raw-material?page=1&perPage=5", requiresAuth: true },
  { method: "GET", path: "/api/subcon-raw-material?page=1&perPage=5", requiresAuth: true },

  { method: "GET", path: "/api/access-control", requiresAuth: true },
];

function normalizeBaseUrl(base: string) {
  return base.trim().replace(/\/+$/, "");
}

export default function SmokeClient() {
  const cookieToken = typeof document !== "undefined" ? getCookiesFromBrowser("Authorization") : null;

  const [baseUrl, setBaseUrl] = useState<string>(apiBaseUrl || "");
  const [token, setToken] = useState<string>(cookieToken || "");
  const [rows, setRows] = useState<Row[]>(
    DEFAULT_ENDPOINTS.map((e) => ({
      key: `${e.method} ${e.path}`,
      method: e.method,
      path: e.path,
      note: e.requiresAuth ? "auth" : "",
    }))
  );
  const [running, setRunning] = useState(false);

  const base = useMemo(() => normalizeBaseUrl(baseUrl), [baseUrl]);

  const columns = useMemo(
    () => [
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 90,
        render: (value: number | undefined, record: Row) => {
          if (value == null) return <Tag color="default">—</Tag>;
          const color = record.ok ? "green" : value >= 500 ? "red" : value === 404 ? "orange" : "gold";
          return <Tag color={color}>{value}</Tag>;
        },
      },
      { title: "Method", dataIndex: "method", key: "method", width: 90 },
      {
        title: "Path",
        dataIndex: "path",
        key: "path",
        render: (value: string) => <Text code>{value}</Text>,
      },
      {
        title: "Time",
        dataIndex: "tookMs",
        key: "tookMs",
        width: 100,
        render: (value: number | undefined) => (value == null ? "" : `${value}ms`),
      },
      { title: "Note", dataIndex: "note", key: "note", width: 220 },
    ],
    []
  );

  const run = async () => {
    const effectiveBase = normalizeBaseUrl(baseUrl);
    if (!effectiveBase) return;

    setRunning(true);

    const next = rows.map((r) => ({
      ...r,
      status: undefined as number | undefined,
      ok: undefined as boolean | undefined,
      tookMs: undefined as number | undefined,
    }));
    setRows(next);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    for (let i = 0; i < next.length; i += 1) {
      const r = next[i];
      const url = `${effectiveBase}${r.path.startsWith("/") ? "" : "/"}${r.path}`;
      const started = performance.now();

      try {
        const res = await fetch(url, { method: r.method, headers });
        const tookMs = Math.round(performance.now() - started);

        let note = r.note || "";
        if (res.status === 401 || res.status === 403) note = `${note} unauthorized`;
        if (res.status === 404) note = `${note} missing-route`;
        if (res.status >= 500) note = `${note} server-error`;

        const text = await res.text().catch(() => "");
        const snippet = text ? text.slice(0, 120).replace(/\s+/g, " ") : "";
        if (snippet) note = `${note} ${snippet}`.trim();

        next[i] = { ...r, status: res.status, ok: res.ok, tookMs, note };
      } catch {
        const tookMs = Math.round(performance.now() - started);
        next[i] = { ...r, status: undefined, ok: false, tookMs, note: `${r.note || ""} network-error`.trim() };
      }

      setRows([...next]);
    }

    setRunning(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Title level={3} style={{ marginTop: 0 }}>
        API Smoke Test (Debug)
      </Title>

      <Paragraph>
        Halaman ini untuk ngetes endpoint API dari browser. Aktifkan hanya saat troubleshooting.
      </Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "160px 1fr" }}>
          <Text strong>Base URL</Text>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-backend.example.com"
          />

          <Text strong>Token</Text>
          <Input.Password
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Ambil dari cookie Authorization (login dulu) atau paste token"
          />

          <div />
          <div className="flex gap-2">
            <Button type="primary" onClick={run} loading={running} disabled={!base}>
              Run Smoke Test
            </Button>
            <Button
              onClick={() => {
                const t = typeof document !== "undefined" ? getCookiesFromBrowser("Authorization") : null;
                if (t) setToken(t);
              }}
            >
              Load Token from Cookie
            </Button>
          </div>
        </div>

        <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>
          Detected env base: <Text code>{apiBaseUrl || "(empty)"}</Text>
        </Paragraph>
      </Card>

      <Table<Row> columns={columns} dataSource={rows} pagination={false} size="middle" rowKey="key" />
    </div>
  );
}
