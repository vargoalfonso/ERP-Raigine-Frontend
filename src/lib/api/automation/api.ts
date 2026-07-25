import { apiBaseUrl, apiSlice } from "@/lib/api/instance";

// RTK Query module for the MRP -> Raigine automation integration.
// These endpoints hit the MRP backend (which proxies to crp-backend):
//   GET  /automation/processes
//   GET  /automation/jobs
//   POST /automation/processes/:id/run
//   POST /automation/processes/:id/stop
//   POST /automation/schedules
//
// injectEndpoints auto-registers into the shared apiSlice, so no store change
// is needed — just import the generated hooks below.

type UnknownRecord = Record<string, unknown>;

const PROCESS_TAG = "AutomationProcesses" as const;
const JOB_TAG = "AutomationJobs" as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

// crp-backend responses vary between { data: [...] }, { data: { data: [...] } }
// and { data: { items: [...] } }. Normalize all of them to a flat array.
const normalizeArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    const data = response.data;
    if (Array.isArray(data)) return data as T[];
    if (isRecord(data)) {
      if (Array.isArray(data.items)) return data.items as T[];
      if (Array.isArray(data.data)) return data.data as T[];
      if (Array.isArray((data as UnknownRecord).rows))
        return (data as UnknownRecord).rows as T[];
    }
  }
  return [];
};

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

export type AutomationProcess = {
  id: string;
  name: string;
  priority?: string;
  executionMode?: string;
  robotName?: string;
  folderName?: string;
  raw: UnknownRecord;
};

export type AutomationJob = {
  id: string;
  processName?: string;
  status?: string;
  priority?: string;
  robotName?: string;
  startedAt?: string;
  endedAt?: string;
  raw: UnknownRecord;
};

export type ListParams = {
  page?: number;
  limit?: number;
  folder_id?: string;
  machine_id?: string;
  process_id?: string;
};

export type CreateScheduleRequest = {
  schedule_name: string;
  automation_process_id: string;
  execution_frequency: string; // every_minute | hourly | daily | weekly | monthly
  start_time: string;
  trigger_priority?: string;
  execute_times?: number;
  timezone?: string;
  folder_id?: string;
};

const toProcess = (raw: unknown): AutomationProcess => {
  const r = isRecord(raw) ? raw : {};
  const robot = isRecord(r.robot) ? r.robot : undefined;
  const folder = isRecord(r.folder) ? r.folder : undefined;
  return {
    id:
      getString(r, ["public_id", "publicId", "process_public_id", "id", "uuid"]) ??
      "",
    name: getString(r, ["name", "process_name", "processName"]) ?? "",
    priority: getString(r, ["priority", "triggerPriority"]),
    executionMode: getString(r, ["executionMode", "execution_mode"]),
    robotName: robot ? getString(robot, ["name"]) : getString(r, ["robotName"]),
    folderName: folder ? getString(folder, ["name"]) : getString(r, ["folderName"]),
    raw: r,
  };
};

const toJob = (raw: unknown): AutomationJob => {
  const r = isRecord(raw) ? raw : {};
  const process = isRecord(r.automationProcess) ? r.automationProcess : undefined;
  const robot = isRecord(r.robot) ? r.robot : undefined;
  return {
    id: getString(r, ["public_id", "publicId", "id", "uuid"]) ?? "",
    processName: process
      ? getString(process, ["name"])
      : getString(r, ["processName", "process_name"]),
    status: getString(r, ["status"]),
    priority: getString(r, ["priority"]),
    robotName: robot ? getString(robot, ["name"]) : getString(r, ["robotName"]),
    startedAt: getString(r, ["startedAt", "started_at", "createdAt", "created_at"]),
    endedAt: getString(r, ["endedAt", "ended_at", "finishedAt", "finished_at"]),
    raw: r,
  };
};

export const automationApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [PROCESS_TAG, JOB_TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getAutomationProcesses: builder.query<AutomationProcess[], ListParams | void>({
        query: (params) => ({
          url: "/automation/processes",
          method: "GET",
          params: params ?? undefined,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response).map(toProcess),
        providesTags: [{ type: PROCESS_TAG, id: "LIST" }],
      }),
      getAutomationJobs: builder.query<AutomationJob[], ListParams | void>({
        query: (params) => ({
          url: "/automation/jobs",
          method: "GET",
          params: params ?? undefined,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response).map(toJob),
        providesTags: [{ type: JOB_TAG, id: "LIST" }],
      }),
      runAutomationProcess: builder.mutation<
        unknown,
        { id: string; job_public_id?: string }
      >({
        query: ({ id, ...body }) => ({
          url: `/automation/processes/${encodeURIComponent(id)}/run`,
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: JOB_TAG, id: "LIST" }],
      }),
      stopAutomationProcess: builder.mutation<unknown, { id: string }>({
        query: ({ id }) => ({
          url: `/automation/processes/${encodeURIComponent(id)}/stop`,
          method: "POST",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: JOB_TAG, id: "LIST" }],
      }),
      createAutomationSchedule: builder.mutation<unknown, CreateScheduleRequest>({
        query: (body) => ({
          url: "/automation/schedules",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
      }),
    }),
  });

export const {
  useGetAutomationProcessesQuery,
  useGetAutomationJobsQuery,
  useRunAutomationProcessMutation,
  useStopAutomationProcessMutation,
  useCreateAutomationScheduleMutation,
} = automationApiSlice;
