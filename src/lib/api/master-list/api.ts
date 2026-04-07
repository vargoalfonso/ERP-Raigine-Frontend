import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse, DataArray } from "@/types";
import type { MasterListRecord } from "./interface";

const TAG = "MasterList" as const;

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
	message,
	status: "success",
	data,
});

const toMasterListRecord = (raw: unknown): MasterListRecord => {
	const r = (raw ?? {}) as Record<string, unknown>;
	return {
		id: String(r.id ?? r.uuid ?? r.key ?? ""),
		uniq_code: (r.uniq_code ?? r.uniqCode) as string | undefined,
		part_no: (r.part_no ?? r.partNo ?? r.part_number ?? r.partNumber) as string | undefined,
		part_name: (r.part_name ?? r.partName ?? r.part_name) as string | undefined,
		size: (r.size ?? r.dimensions) as string | undefined,
		model: (r.model ?? r.model_name) as string | undefined,
		kanban_quantity: typeof r.kanban_quantity === "number" ? r.kanban_quantity : (typeof r.kanbanQuantity === "number" ? (r.kanbanQuantity as number) : undefined),
		threshold_kanban: typeof r.threshold_kanban === "number" ? r.threshold_kanban : (typeof r.thresholdKanban === "number" ? (r.thresholdKanban as number) : undefined),
		uom: (r.uom ?? r.unit_measurement ?? r.unitMeasurement) as string | undefined,
		weight: typeof r.weight === "number" ? r.weight : (typeof r.weigh_kg === "number" ? (r.weigh_kg as number) : undefined),
		type: (r.type ?? r.category) as string | undefined,
		status: (r.status ?? r.state) as MasterListRecord["status"],
		created_by: (r.created_by ?? r.createdBy) as string | undefined,
		updated_by: (r.updated_by ?? r.updatedBy) as string | undefined,
		created_at: (r.created_at ?? r.createdAt) as string | undefined,
		updated_at: (r.updated_at ?? r.updatedAt) as string | undefined,
	};
};

export const masterListApiSlice = apiSlice
	.enhanceEndpoints({ addTagTypes: [TAG] })
	.injectEndpoints({
		endpoints: (builder) => ({
			listMaster: builder.query<ApiResponse<DataArray<MasterListRecord>>, void>({
				query: () => ({
					url: "/api/master",
					method: "GET",
					meta: { useAuthorization: true, contentType: "application/json" },
				}),
				transformResponse: (response: unknown) => {
					const unwrapped = unwrapBackendData<unknown>(response);
					const list = Array.isArray(unwrapped) ? unwrapped : [];
					return ok((list as unknown[]).map(toMasterListRecord));
				},
				providesTags: [{ type: TAG, id: "LIST" }],
			}),
		}),
	});

export const { useListMasterQuery } = masterListApiSlice;
