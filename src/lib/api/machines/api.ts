import { apiBaseUrl, apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const TAG = "Machines" as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const normalizeArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    const data = response.data;
    if (Array.isArray(data)) return data as T[];
    if (isRecord(data)) {
      // Handle { data: { items: [...] } } — paginated backend responses
      if (Array.isArray(data.items)) return data.items as T[];
      if (Array.isArray(data.data)) return data.data as T[];
    }
  }
  return [];
};

const normalizeObjectResponse = <T,>(response: unknown): T | null => {
  if (isRecord(response)) {
    const data = response.data;
    if (isRecord(data)) return data as T;
    if (isRecord(data) && isRecord(data.data)) return data.data as T;
  }
  return isRecord(response) ? (response as T) : null;
};

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const getNumber = (record: UnknownRecord, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

export type MachineRecord = {
  id: string;
  machine_name: string;
  machine_number: string;
  production_line: string;
  process_id?: string;
  process_name?: string;
  machine_capacity: number;
  status?: string;
};

export type CreateMachineRequest = {
  machine_name: string;
  machine_number: string;
  production_line: string;
  process_id: string | number;
  machine_capacity?: number | null;
  status?: string;
};

export type UpdateMachineRequest = Partial<CreateMachineRequest>;

const toMachineRecord = (raw: unknown): MachineRecord => {
  const record = isRecord(raw) ? raw : {};
  const nestedProcess = isRecord(record.process) ? record.process : undefined;

  const rawId = record.id ?? record.uuid ?? record.machine_id ?? record.machineId;
  const resolvedId =
    rawId !== undefined && rawId !== null
      ? String(rawId)
      : (getString(record, ["machine_number", "machineNumber"]) ?? "");

  return {
    id: resolvedId,
    machine_name:
      getString(record, ["machine_name", "machineName", "name"]) ?? "",
    machine_number:
      getString(record, ["machine_number", "machineNumber", "number"]) ?? "",
    production_line:
      getString(record, ["production_line", "productionLine", "line"]) ?? "",
    process_id:
      getString(record, ["process_id", "processId"]) ??
      (nestedProcess
        ? getString(nestedProcess, ["id", "uuid", "process_id", "processId"])
        : undefined),
    process_name:
      getString(record, ["process_name", "processName"]) ??
      (nestedProcess
        ? getString(nestedProcess, ["process_name", "processName", "name"])
        : undefined),
    machine_capacity:
      getNumber(record, ["machine_capacity", "machineCapacity", "capacity"]) ?? 0,
    status: getString(record, ["status"]),
  };
};

export const getMachineQrCodeUrl = (id: string) => {
  const path = `/api/master/machines/${encodeURIComponent(id)}/qrcode`;
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export const getMachinePrintUrl = (id: string) => {
  const path = `/api/master/machines/${encodeURIComponent(id)}/print`;
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export const machinesApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getMachines: builder.query<MachineRecord[], { page?: number; limit?: number } | void>({
        query: (params) => ({
          url: "/machines",
          method: "GET",
          params,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response).map(toMachineRecord),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(
            result
              .map((record) => record.id)
              .filter(Boolean)
              .map((id) => ({ type: TAG, id })),
          );
        },
      }),
      createMachine: builder.mutation<MachineRecord, CreateMachineRequest>({
        query: (body) => ({
          url: "/machines",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toMachineRecord(normalizeObjectResponse<unknown>(response) ?? response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),
      updateMachine: builder.mutation<MachineRecord, { id: string | number; body: UpdateMachineRequest }>({
        query: ({ id, body }) => ({
          url: `/machines/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toMachineRecord(normalizeObjectResponse<unknown>(response) ?? response),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),
      deleteMachine: builder.mutation<{ success?: boolean; id?: string | number } | unknown, string | number>({
        query: (id) => ({
          url: `/machines/${encodeURIComponent(String(id))}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_result, _error, id) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(id) },
        ],
      }),
    }),
  });

export const {
  useGetMachinesQuery,
  useCreateMachineMutation,
  useUpdateMachineMutation,
  useDeleteMachineMutation,
} = machinesApiSlice;
