import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const TAG = "MachineParameters" as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toText = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

export type MachineParameterRecord = {
  id: string;
  machine_name: string;
  machine_count: number;
  operating_hours: number;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type MachineParameterListRequest = {
  page: number;
  limit: number;
};

export type MachineParameterPagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type MachineParameterListResponse = {
  items: MachineParameterRecord[];
  pagination: MachineParameterPagination;
};

export type CreateMachineParameterRequest = {
  machine_name: string;
  machine_count: number;
  operating_hours: number;
  status: string;
};

export type UpdateMachineParameterRequest = Partial<CreateMachineParameterRequest>;

const toMachineParameterRecord = (value: unknown): MachineParameterRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: toText(record.id ?? record.machine_id ?? record.uuid),
    machine_name: toText(record.machine_name ?? record.machineName),
    machine_count: toNumber(record.machine_count ?? record.machineCount),
    operating_hours: toNumber(record.operating_hours ?? record.operatingHours),
    status: toText(record.status, "Active"),
    created_at: toText(record.created_at),
    updated_at: toText(record.updated_at),
  };
};

const toListResponse = (response: unknown, fallback: MachineParameterListRequest): MachineParameterListResponse => {
  const root = isRecord(response) ? response : {};
  const data = isRecord(root.data) ? root.data : {};
  const items = Array.isArray(data.items) ? data.items.map(toMachineParameterRecord) : [];
  const pagination = isRecord(data.pagination) ? data.pagination : {};

  return {
    items,
    pagination: {
      total: toNumber(pagination.total, items.length),
      page: toNumber(pagination.page, fallback.page),
      limit: toNumber(pagination.limit, fallback.limit),
      total_pages: toNumber(
        pagination.total_pages,
        Math.max(1, Math.ceil((toNumber(pagination.total, items.length) || items.length) / Math.max(1, fallback.limit)))
      ),
    },
  };
};

const toObjectResponse = (response: unknown) => {
  const root = isRecord(response) ? response : {};
  const data = isRecord(root.data) ? root.data : root;
  return toMachineParameterRecord(data);
};

export const machineParametersApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getMachineParameters: builder.query<MachineParameterListResponse, MachineParameterListRequest>({
        query: ({ page, limit }) => ({
          url: "/machine-parameter",
          method: "GET",
          params: { page, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown, _meta, arg) => toListResponse(response, arg),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(result.items.map((item) => ({ type: TAG, id: item.id })));
        },
      }),
      createMachineParameter: builder.mutation<MachineParameterRecord, CreateMachineParameterRequest>({
        query: (body) => ({
          url: "/machine-parameter",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => toObjectResponse(response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),
      updateMachineParameter: builder.mutation<MachineParameterRecord, { id: string | number; body: UpdateMachineParameterRequest }>({
        query: ({ id, body }) => ({
          url: `/machine-parameter/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => toObjectResponse(response),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),
      deleteMachineParameter: builder.mutation<{ success?: boolean }, string | number>({
        query: (id) => ({
          url: `/machine-parameter/${encodeURIComponent(String(id))}`,
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
  useGetMachineParametersQuery,
  useCreateMachineParameterMutation,
  useUpdateMachineParameterMutation,
  useDeleteMachineParameterMutation,
} = machineParametersApiSlice;
