"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Radio,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ClockCircleOutlined,
  SaveOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useListForecastSchedulesQuery,
  useUpsertForecastScheduleMutation,
  type ForecastDomain,
  type ForecastSchedule,
  type ScheduleDayOfWeek,
  type ScheduleFrequency,
  type UpsertForecastScheduleRequest,
} from "@/lib/api/forecasting/api";
import {
  useGetSafetyStockQuery,
  useGetStockdaysQuery,
} from "@/lib/api/system-settings/api";

type DomainMeta = {
  domain: ForecastDomain;
  title: string;
  subtitle: string;
  dataTag: string;
  frequencies: ScheduleFrequency[];
};

const DOMAINS: DomainMeta[] = [
  {
    domain: "dn",
    title: "Delivery Note (DN)",
    subtitle: "Forecast dari data pengiriman customer",
    dataTag: "Data harian",
    frequencies: ["daily", "weekly", "monthly"],
  },
  {
    domain: "prl",
    title: "PRL",
    subtitle: "Forecast dari data PRL customer",
    dataTag: "Data bulanan",
    frequencies: ["monthly"],
  },
];

const FREQUENCY_LABEL: Record<ScheduleFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const DAY_OPTIONS: { value: ScheduleDayOfWeek; label: string; jsDay: number }[] = [
  { value: "monday", label: "Senin", jsDay: 1 },
  { value: "tuesday", label: "Selasa", jsDay: 2 },
  { value: "wednesday", label: "Rabu", jsDay: 3 },
  { value: "thursday", label: "Kamis", jsDay: 4 },
  { value: "friday", label: "Jumat", jsDay: 5 },
  { value: "saturday", label: "Sabtu", jsDay: 6 },
  { value: "sunday", label: "Minggu", jsDay: 0 },
];

const DATE_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `Tanggal ${i + 1}`,
}));

const MODEL_OPTIONS = [
  { value: "Chronos2", label: "Chronos2 (default)" },
  { value: "RandomForest", label: "RandomForest" },
  { value: "Arima", label: "Arima" },
];

const TIME_FORMAT = "HH:mm";
const FORECAST_CALCULATION_TYPE = "forecast";

const defaultSchedule = (meta: DomainMeta): UpsertForecastScheduleRequest => ({
  domain: meta.domain,
  is_active: false,
  frequency: meta.domain === "dn" ? "weekly" : "monthly",
  run_time: "02:00",
  day_of_week: meta.domain === "dn" ? "monday" : null,
  day_of_month: meta.domain === "prl" ? 1 : null,
  timezone: "Asia/Jakarta",
  selected_model: "Chronos2",
});

const toDraft = (
  meta: DomainMeta,
  saved?: ForecastSchedule,
): UpsertForecastScheduleRequest => {
  const base = defaultSchedule(meta);
  if (!saved) return base;
  const frequency = meta.frequencies.includes(saved.frequency)
    ? saved.frequency
    : base.frequency;
  return {
    ...base,
    is_active: Boolean(saved.is_active),
    frequency,
    run_time: saved.run_time || base.run_time,
    day_of_week: saved.day_of_week ?? base.day_of_week ?? "monday",
    day_of_month: saved.day_of_month ?? base.day_of_month ?? 1,
    timezone: saved.timezone || base.timezone,
    selected_model: saved.selected_model || base.selected_model,
  };
};

/** Normalise the draft into the payload the backend expects (drop unused fields). */
const toPayload = (draft: UpsertForecastScheduleRequest): UpsertForecastScheduleRequest => ({
  ...draft,
  day_of_week: draft.frequency === "weekly" ? draft.day_of_week ?? "monday" : null,
  day_of_month: draft.frequency === "monthly" ? draft.day_of_month ?? 1 : null,
});

const sameDraft = (a: UpsertForecastScheduleRequest, b: UpsertForecastScheduleRequest) =>
  JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b));

/** Next run computed in the browser's clock (preview only; the script/backend is the source of truth). */
const computeNextRun = (draft: UpsertForecastScheduleRequest, now: Dayjs = dayjs()): Dayjs => {
  const [h, m] = draft.run_time.split(":").map((v) => Number(v) || 0);
  const atTime = (d: Dayjs) => d.hour(h).minute(m).second(0).millisecond(0);

  if (draft.frequency === "daily") {
    const today = atTime(now);
    return today.isAfter(now) ? today : today.add(1, "day");
  }

  if (draft.frequency === "weekly") {
    const target = DAY_OPTIONS.find((d) => d.value === draft.day_of_week)?.jsDay ?? 1;
    let candidate = atTime(now).add((target - now.day() + 7) % 7, "day");
    if (!candidate.isAfter(now)) candidate = candidate.add(7, "day");
    return candidate;
  }

  const dom = draft.day_of_month ?? 1;
  const inMonth = (month: Dayjs) =>
    atTime(month.date(Math.min(dom, month.daysInMonth())));
  const thisMonth = inMonth(now.startOf("month"));
  return thisMonth.isAfter(now) ? thisMonth : inMonth(now.startOf("month").add(1, "month"));
};

const describeSchedule = (draft: UpsertForecastScheduleRequest): string => {
  const time = `pukul ${draft.run_time} WIB`;
  if (draft.frequency === "daily") return `Setiap hari ${time}`;
  if (draft.frequency === "weekly") {
    const day = DAY_OPTIONS.find((d) => d.value === draft.day_of_week)?.label ?? "Senin";
    return `Setiap hari ${day} ${time}`;
  }
  return `Setiap tanggal ${draft.day_of_month ?? 1} tiap bulan ${time}`;
};

const formatDateTime = (value?: string | null) =>
  value && dayjs(value).isValid() ? dayjs(value).format("DD MMM YYYY HH:mm") : "-";

const statusColor = (status?: string | null) => {
  const s = String(status ?? "").toUpperCase();
  if (s === "SUCCEEDED") return "green";
  if (s === "FAILED" || s === "CANCELLED") return "red";
  if (s === "RUNNING" || s === "PENDING") return "blue";
  return "default";
};

/** 404 from Go comes back as plain text ("404 page not found") -> PARSING_ERROR in RTK Query. */
const isEndpointMissing = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown; originalStatus?: unknown };
  return e.status === 404 || e.originalStatus === 404;
};

const scheduleErrorText = (error: unknown) =>
  isEndpointMissing(error)
    ? "Endpoint /forecasting/schedules belum tersedia di backend."
    : `${getApiErrorMessage(error, "Gagal memuat jadwal")}.`;

type ForecastUniqRow = {
  uniq: string;
  inventoryType: string;
  usedIn: ("Safety Stock" | "Stockdays")[];
  active: boolean;
};

const isActiveStatus = (status?: string) => {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "" || s === "active";
};

type AutomationSettingsPanelProps = {
  canUpdate: boolean;
};

export default function AutomationSettingsPanel({ canUpdate }: AutomationSettingsPanelProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isLoading, isError, error } = useListForecastSchedulesQuery();
  const [upsertSchedule] = useUpsertForecastScheduleMutation();
  const { data: safetyStockData, isFetching: loadingSafety } = useGetSafetyStockQuery();
  const { data: stockdaysData, isFetching: loadingStockdays } = useGetStockdaysQuery();
  const [uniqQuery, setUniqQuery] = useState("");

  const savedByDomain = useMemo(() => {
    const map: Partial<Record<ForecastDomain, ForecastSchedule>> = {};
    (data ?? []).forEach((s) => {
      if (s?.domain === "dn" || s?.domain === "prl") map[s.domain] = s;
    });
    return map;
  }, [data]);

  const [drafts, setDrafts] = useState<Record<ForecastDomain, UpsertForecastScheduleRequest>>(
    () => ({
      dn: defaultSchedule(DOMAINS[0]),
      prl: defaultSchedule(DOMAINS[1]),
    }),
  );
  const [savingDomain, setSavingDomain] = useState<ForecastDomain | null>(null);

  // Reset drafts whenever the server data changes.
  useEffect(() => {
    setDrafts({
      dn: toDraft(DOMAINS[0], savedByDomain.dn),
      prl: toDraft(DOMAINS[1], savedByDomain.prl),
    });
  }, [savedByDomain]);

  // Uniq (FG) that use "Demand Forecasting" in Safety Stock / Stockdays parameters.
  const forecastUniqs = useMemo<ForecastUniqRow[]>(() => {
    const byUniq = new Map<string, ForecastUniqRow>();
    const add = (
      uniq: string,
      inventoryType: string,
      source: ForecastUniqRow["usedIn"][number],
      status?: string,
    ) => {
      const key = uniq.trim();
      if (!key) return;
      const row = byUniq.get(key) ?? {
        uniq: key,
        inventoryType: inventoryType || "-",
        usedIn: [],
        active: false,
      };
      if (!row.usedIn.includes(source)) row.usedIn.push(source);
      row.active = row.active || isActiveStatus(status);
      byUniq.set(key, row);
    };
    (safetyStockData ?? []).forEach((r) => {
      if (String(r.calculation_type ?? "").toLowerCase() === FORECAST_CALCULATION_TYPE) {
        add(String(r.item_uniq_code ?? ""), String(r.inventory_type ?? ""), "Safety Stock", r.status);
      }
    });
    (stockdaysData ?? []).forEach((r) => {
      if (String(r.calculation_type ?? "").toLowerCase() === FORECAST_CALCULATION_TYPE) {
        add(String(r.item_code ?? ""), String(r.inventory_type ?? ""), "Stockdays", r.status);
      }
    });
    return Array.from(byUniq.values()).sort((a, b) => a.uniq.localeCompare(b.uniq));
  }, [safetyStockData, stockdaysData]);

  const filteredUniqs = useMemo(() => {
    const q = uniqQuery.trim().toLowerCase();
    if (!q) return forecastUniqs;
    return forecastUniqs.filter((r) =>
      [r.uniq, r.inventoryType, ...r.usedIn].join(" ").toLowerCase().includes(q),
    );
  }, [forecastUniqs, uniqQuery]);

  const uniqColumns: ColumnsType<ForecastUniqRow> = [
    { title: "Uniq", dataIndex: "uniq", key: "uniq", render: (v: string) => <span className="font-medium">{v}</span> },
    { title: "Inventory Type", dataIndex: "inventoryType", key: "inventoryType" },
    {
      title: "Dipakai di",
      key: "usedIn",
      render: (_, r) =>
        r.usedIn.map((u) => (
          <Tag key={u} color={u === "Safety Stock" ? "cyan" : "purple"}>
            {u}
          </Tag>
        )),
    },
    {
      title: "Status",
      key: "active",
      width: 100,
      render: (_, r) => <Tag color={r.active ? "green" : "default"}>{r.active ? "Active" : "Inactive"}</Tag>,
    },
  ];

  const updateDraft = (domain: ForecastDomain, patch: Partial<UpsertForecastScheduleRequest>) =>
    setDrafts((prev) => ({ ...prev, [domain]: { ...prev[domain], ...patch } }));

  const handleSave = async (meta: DomainMeta) => {
    setSavingDomain(meta.domain);
    try {
      await upsertSchedule(toPayload(drafts[meta.domain])).unwrap();
      messageApi.success(`Jadwal training ${meta.title} berhasil disimpan`);
    } catch (err) {
      messageApi.error(
        isEndpointMissing(err)
          ? "Gagal menyimpan: endpoint jadwal belum tersedia di backend"
          : getApiErrorMessage(err, `Gagal menyimpan jadwal ${meta.title}`),
      );
    } finally {
      setSavingDomain(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      {contextHolder}
      <div className="bg-blue-50 rounded-t-2xl px-5 py-4 border-b">
        <div className="text-lg font-semibold text-gray-900">Automation</div>
        <div className="text-sm text-gray-500">
          Jadwal training Demand Forecasting untuk DN dan PRL. Jadwal ini dibaca oleh script
          forecasting, dan hasilnya dipakai Safety Stock &amp; Stockdays dengan kalkulasi
          &quot;Demand Forecasting&quot;.
        </div>
      </div>

      <div className="p-5 space-y-4">
        {isError && (
          <Alert
            type="warning"
            showIcon
            message="Jadwal belum bisa dimuat dari server"
            description={`${scheduleErrorText(error)} Form menampilkan nilai default dan belum bisa disimpan sampai API backend tersedia.`}
          />
        )}

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Spin />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {DOMAINS.map((meta) => {
              const draft = drafts[meta.domain];
              const saved = savedByDomain[meta.domain];
              const baseline = toDraft(meta, saved);
              const dirty = !sameDraft(draft, baseline);
              const disabled = !canUpdate;
              const fieldsDisabled = disabled || !draft.is_active;
              const nextRun = computeNextRun(draft);

              return (
                <div
                  key={meta.domain}
                  className="rounded-xl border border-gray-200 bg-white flex flex-col"
                >
                  <div className="px-4 py-3 border-b flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{meta.title}</span>
                        <Tag color={meta.domain === "dn" ? "blue" : "purple"}>{meta.dataTag}</Tag>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{meta.subtitle}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">
                        {draft.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                      <Switch
                        checked={draft.is_active}
                        disabled={disabled}
                        onChange={(checked) => updateDraft(meta.domain, { is_active: checked })}
                      />
                    </div>
                  </div>

                  <div className="px-4 py-4 space-y-4 flex-1">
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1.5">Frekuensi</div>
                      <Radio.Group
                        optionType="button"
                        buttonStyle="solid"
                        disabled={fieldsDisabled}
                        value={draft.frequency}
                        onChange={(e) =>
                          updateDraft(meta.domain, { frequency: e.target.value as ScheduleFrequency })
                        }
                      >
                        {(["daily", "weekly", "monthly"] as ScheduleFrequency[]).map((f) => {
                          const allowed = meta.frequencies.includes(f);
                          const button = (
                            <Radio.Button key={f} value={f} disabled={!allowed}>
                              {FREQUENCY_LABEL[f]}
                            </Radio.Button>
                          );
                          return allowed ? (
                            button
                          ) : (
                            <Tooltip key={f} title="Data PRL bulanan, hanya bisa Monthly">
                              {button}
                            </Tooltip>
                          );
                        })}
                      </Radio.Group>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {draft.frequency === "weekly" && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1.5">Hari</div>
                          <Select
                            className="w-full"
                            disabled={fieldsDisabled}
                            value={draft.day_of_week ?? "monday"}
                            options={DAY_OPTIONS.map(({ value, label }) => ({ value, label }))}
                            onChange={(value) => updateDraft(meta.domain, { day_of_week: value })}
                          />
                        </div>
                      )}
                      {draft.frequency === "monthly" && (
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1.5">Tanggal</div>
                          <Select
                            className="w-full"
                            disabled={fieldsDisabled}
                            value={draft.day_of_month ?? 1}
                            options={DATE_OPTIONS}
                            onChange={(value) => updateDraft(meta.domain, { day_of_month: value })}
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1.5">Jam (WIB)</div>
                        <TimePicker
                          className="w-full"
                          format={TIME_FORMAT}
                          minuteStep={15}
                          allowClear={false}
                          needConfirm={false}
                          disabled={fieldsDisabled}
                          value={dayjs(draft.run_time, TIME_FORMAT)}
                          onChange={(value) =>
                            value && updateDraft(meta.domain, { run_time: value.format(TIME_FORMAT) })
                          }
                        />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1.5">Model</div>
                        <Select
                          className="w-full"
                          disabled={fieldsDisabled}
                          value={draft.selected_model ?? "Chronos2"}
                          options={MODEL_OPTIONS}
                          onChange={(value) => updateDraft(meta.domain, { selected_model: value })}
                        />
                      </div>
                    </div>
                    {draft.frequency === "monthly" && (draft.day_of_month ?? 1) > 28 && (
                      <div className="text-xs text-amber-600 -mt-2">
                        Bulan yang tidak punya tanggal {draft.day_of_month} akan dijalankan di hari terakhir bulan itu.
                      </div>
                    )}

                    <div
                      className={
                        "rounded-lg px-3 py-2.5 text-sm flex items-start gap-2 " +
                        (draft.is_active ? "bg-blue-50 text-blue-800" : "bg-gray-50 text-gray-500")
                      }
                    >
                      <ClockCircleOutlined className="mt-0.5" />
                      <div>
                        {draft.is_active ? (
                          <>
                            <div className="font-medium">{describeSchedule(draft)}</div>
                            <div className="text-xs mt-0.5">
                              Berikutnya:{" "}
                              {DAY_OPTIONS.find((d) => d.jsDay === nextRun.day())?.label},{" "}
                              {nextRun.format("DD MMM YYYY HH:mm")}
                            </div>
                          </>
                        ) : (
                          <div>Training otomatis tidak dijalankan.</div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <div>
                        Last run: <span className="text-gray-700">{formatDateTime(saved?.last_run_at)}</span>
                      </div>
                      <div>
                        Status:{" "}
                        {saved?.last_run_status ? (
                          <Tooltip title={saved.last_run_message || undefined}>
                            <Tag color={statusColor(saved.last_run_status)} className="!mr-0">
                              {saved.last_run_status}
                            </Tag>
                          </Tooltip>
                        ) : (
                          <span className="text-gray-700">-</span>
                        )}
                      </div>
                      <div className="col-span-2">
                        Terakhir diubah:{" "}
                        <span className="text-gray-700">
                          {formatDateTime(saved?.updated_at)}
                          {saved?.updated_by ? ` oleh ${saved.updated_by}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t flex justify-end gap-2">
                    <Button
                      icon={<UndoOutlined />}
                      disabled={!dirty || savingDomain === meta.domain}
                      onClick={() => setDrafts((prev) => ({ ...prev, [meta.domain]: baseline }))}
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      disabled={disabled || !dirty}
                      loading={savingDomain === meta.domain}
                      onClick={() => handleSave(meta)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold text-gray-900">
                Uniq yang memakai Demand Forecasting{" "}
                <Tag className="!ml-1">{forecastUniqs.length}</Tag>
              </div>
              <div className="text-xs text-gray-500">
                Dari Safety Stock &amp; Stockdays Parameters dengan Calculation Type &quot;Demand
                Forecasting result for each Uniq&quot;.
              </div>
            </div>
            <Input
              allowClear
              className="!w-full sm:!w-64"
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Cari uniq..."
              value={uniqQuery}
              onChange={(e) => setUniqQuery(e.target.value)}
            />
          </div>
          <Table<ForecastUniqRow>
            size="small"
            rowKey="uniq"
            columns={uniqColumns}
            dataSource={filteredUniqs}
            loading={loadingSafety || loadingStockdays}
            pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
            locale={{ emptyText: "Belum ada uniq yang memakai Demand Forecasting" }}
            scroll={{ x: true }}
          />
        </div>

        {!canUpdate && (
          <div className="text-xs text-gray-500">
            Anda hanya punya akses lihat. Butuh permission update di modul Forecasting untuk mengubah jadwal.
          </div>
        )}
      </div>
    </div>
  );
}
