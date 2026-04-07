import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse, DataArray, DataObject } from "@/types";

const TAG = "ProcurementPos" as const;

export type ProcurementPoCategory = "RAW_MATERIAL" | "INDIRECT_RAW_MATERIAL" | "SUBCON";

export type ProcurementPoRecord = {
	id: string;
	po_category?: ProcurementPoCategory;
	month?: string; // YYYY-MM
	po_number?: string;
	supplier_name?: string;
	subcon_name?: string;
	data_order?: string;
	date_incoming?: string; // YYYY-MM-DD
	total_po?: number;
	total_incoming?: number;
	expected_arrival?: string; // YYYY-MM-DD
	status?: string;
	notes?: string;
	dn_created?: number;
	dn_incoming?: number;
	created_at?: string;
	updated_at?: string;
};

export type ProcurementPoBoardRow = {
	id: string;
	po_id?: string;
	po_category?: ProcurementPoCategory;
	month?: string;
	po_number?: string;
	supplier_name?: string;
	subcon_name?: string;
	data_order?: string;
	date_incoming?: string;
	total_po?: number;
	total_incoming?: number;
	expected_arrival?: string;
	dn_created?: number;
	dn_incoming?: number;
	open_po?: number;
	po_alert?: number;
	status?: string;
};

export type ProcurementPoFilters = {
	category?: ProcurementPoCategory;
	month?: string; // YYYY-MM
	supplier?: string;
	subcon?: string;
};

export type CreateProcurementPoRequest = {
	po_category: ProcurementPoCategory;
	month: string;
	po_number: string;
	supplier_name?: string;
	subcon_name?: string;
	data_order?: string;
	date_incoming?: string;
	total_po?: number;
	total_budget_po?: number;
	total_incoming?: number;
	dn_created?: number;
	dn_incoming?: number;
	expected_arrival?: string;
	status?: string;
	notes?: string;

	// Item-ish fields (optional, commonly used by UI)
	uniq?: string;
	spec_material?: string;
	uom?: string;
	weigh_kg?: number;
	packing?: string;
	pcs_kanban?: number;

	// Budget linkage
	po_budget_id?: number;
	po_budget_number?: string;
};

export type BulkCreateProcurementPoResult = {
	count: number;
	ids: string[];
};

const getCategoryListEndpoint = (category?: ProcurementPoCategory) => {
	if (category === "INDIRECT_RAW_MATERIAL") return "/api/procurement/po-indirectrm";
	if (category === "SUBCON") return "/api/procurement/po-subcon";
	return "/api/procurement/po-rm";
};

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
	message,
	status: "success",
	data,
});

const toNumber = (value: unknown): number | undefined => {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(n) ? n : undefined;
};

const toPo = (raw: unknown): ProcurementPoRecord => {
	const r = (raw ?? {}) as Record<string, unknown>;
	const id = String(r.id ?? r.po_id ?? r.uuid ?? r.key ?? "");
	return {
		id,
		po_category: (r.po_category ?? r.poCategory) as ProcurementPoCategory | undefined,
		month: (r.month ?? r.period) as string | undefined,
		po_number: (r.po_number ?? r.poNumber) as string | undefined,
		supplier_name: (r.supplier_name ?? r.supplierName) as string | undefined,
		subcon_name: (r.subcon_name ?? r.subconName) as string | undefined,
		data_order: (r.data_order ?? r.dataOrder) as string | undefined,
		date_incoming: (r.date_incoming ?? r.dateIncoming) as string | undefined,
		total_po: toNumber(r.total_po ?? r.totalPo),
		total_incoming: toNumber(r.total_incoming ?? r.totalIncoming),
		expected_arrival: (r.expected_arrival ?? r.expectedArrival) as string | undefined,
		status: (r.status ?? r.po_status) as string | undefined,
		notes: (r.notes ?? r.note) as string | undefined,
		dn_created: toNumber(r.dn_created ?? r.dnCreated),
		dn_incoming: toNumber(r.dn_incoming ?? r.dnIncoming),
		created_at: (r.created_at ?? r.createdAt) as string | undefined,
		updated_at: (r.updated_at ?? r.updatedAt) as string | undefined,
	};
};

const toBoardRow = (raw: unknown): ProcurementPoBoardRow => {
	const r = (raw ?? {}) as Record<string, unknown>;
	const id = String(r.id ?? r.po_id ?? r.poId ?? r.key ?? "");
	return {
		id,
		po_id: (r.po_id ?? r.poId) as string | undefined,
		po_category: (r.po_category ?? r.poCategory) as ProcurementPoCategory | undefined,
		month: (r.month ?? r.period) as string | undefined,
		po_number: (r.po_number ?? r.poNumber) as string | undefined,
		supplier_name: (r.supplier_name ?? r.supplierName) as string | undefined,
		subcon_name: (r.subcon_name ?? r.subconName) as string | undefined,
		data_order: (r.data_order ?? r.dataOrder) as string | undefined,
		date_incoming: (r.date_incoming ?? r.dateIncoming) as string | undefined,
		total_po: toNumber(r.total_po ?? r.totalPo),
		total_incoming: toNumber(r.total_incoming ?? r.totalIncoming),
		expected_arrival: (r.expected_arrival ?? r.expectedArrival) as string | undefined,
		dn_created: toNumber(r.dn_created ?? r.dnCreated),
		dn_incoming: toNumber(r.dn_incoming ?? r.dnIncoming),
		open_po: toNumber(r.open_po ?? r.openPo),
		po_alert: toNumber(r.po_alert ?? r.poAlert),
		status: (r.status ?? r.po_status) as string | undefined,
	};
};

const toQueryString = (filters?: ProcurementPoFilters): string => {
	if (!filters) return "";
	const params = new URLSearchParams();
	if (filters.month) params.set("month", filters.month);
	if (filters.supplier) params.set("supplier", filters.supplier);
	if (filters.subcon) params.set("subcon", filters.subcon);
	const qs = params.toString();
	return qs ? `?${qs}` : "";
};

export const procurementPoApiSlice = apiSlice
	.enhanceEndpoints({ addTagTypes: [TAG] })
	.injectEndpoints({
	endpoints: (builder) => ({
		getProcurementPoBoard: builder.query<ApiResponse<DataArray<ProcurementPoBoardRow>>, ProcurementPoFilters | void>({
			query: (filters) => ({
				url: `${getCategoryListEndpoint(filters?.category)}${toQueryString(filters || undefined)}`,
				method: "GET",
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (response: unknown) => {
				const unwrapped = unwrapBackendData<unknown>(response);
				const list = Array.isArray(unwrapped)
					? unwrapped
					: unwrapped && typeof unwrapped === "object" && Array.isArray((unwrapped as Record<string, unknown>).data)
						? ((unwrapped as Record<string, unknown>).data as unknown[])
						: [];
				return ok((list as unknown[]).map(toBoardRow));
			},
			providesTags: [{ type: TAG, id: "BOARD" }],
		}),

		listProcurementPos: builder.query<ApiResponse<DataArray<ProcurementPoRecord>>, ProcurementPoFilters | void>({
			query: (filters) => ({
				url: `${getCategoryListEndpoint(filters?.category)}${toQueryString(filters || undefined)}`,
				method: "GET",
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (response: unknown) => {
				const unwrapped = unwrapBackendData<unknown>(response);
				const list = Array.isArray(unwrapped)
					? unwrapped
					: unwrapped && typeof unwrapped === "object" && Array.isArray((unwrapped as Record<string, unknown>).data)
						? ((unwrapped as Record<string, unknown>).data as unknown[])
						: [];
				return ok((list as unknown[]).map(toPo));
			},
			providesTags: [{ type: TAG, id: "LIST" }],
		}),

		createProcurementPo: builder.mutation<ApiResponse<DataObject<ProcurementPoRecord>>, CreateProcurementPoRequest>({
			query: (body) => ({
				url: "/api/procurement/po-rm",
				method: "POST",
				body,
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (response: unknown) => ok(toPo(unwrapBackendData(response)), "Created"),
			invalidatesTags: [{ type: TAG, id: "LIST" }, { type: TAG, id: "BOARD" }],
		}),

		bulkCreateProcurementPos: builder.mutation<
			ApiResponse<DataObject<BulkCreateProcurementPoResult>>,
			CreateProcurementPoRequest[] | { items: CreateProcurementPoRequest[] }
		>({
			query: (body) => ({
				url: "/api/procurement/po/bulk",
				method: "POST",
				body,
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (response: unknown) => {
				const unwrapped = unwrapBackendData<unknown>(response);
				if (unwrapped && typeof unwrapped === "object") {
					const r = unwrapped as Record<string, unknown>;
					const ids = Array.isArray(r.ids) ? r.ids.map((v) => String(v)) : [];
					const count = typeof r.count === "number" ? r.count : ids.length;
					return ok({ count, ids }, "Created");
				}
				return ok({ count: 0, ids: [] }, "Created");
			},
			invalidatesTags: [{ type: TAG, id: "LIST" }, { type: TAG, id: "BOARD" }],
		}),

		getProcurementPoById: builder.query<ApiResponse<DataObject<ProcurementPoRecord>>, string>({
			query: (id) => ({
				url: `/api/procurement/po/${encodeURIComponent(id)}`,
				method: "GET",
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (response: unknown) => ok(toPo(unwrapBackendData(response))),
			providesTags: (_res, _err, id) => [{ type: TAG, id }],
		}),

		patchProcurementPo: builder.mutation<ApiResponse<DataObject<ProcurementPoRecord>>, { id: string; body: Partial<CreateProcurementPoRequest> }>({
			query: ({ id, body }) => ({
				url: `/api/procurement/po/${encodeURIComponent(id)}`,
				method: "PATCH",
				body,
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (response: unknown) => ok(toPo(unwrapBackendData(response)), "Updated"),
			invalidatesTags: (_res, _err, arg) => [{ type: TAG, id: "LIST" }, { type: TAG, id: "BOARD" }, { type: TAG, id: arg.id }],
		}),

		deleteProcurementPo: builder.mutation<ApiResponse<DataObject<{ id: string }>>, string>({
			query: (id) => ({
				url: `/api/procurement/po/${encodeURIComponent(id)}`,
				method: "DELETE",
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (_response: unknown, _meta, arg) => ok({ id: arg }, "Deleted"),
			invalidatesTags: (_res, _err, id) => [{ type: TAG, id: "LIST" }, { type: TAG, id: "BOARD" }, { type: TAG, id }],
		}),
	}),
	});

export const {
	useGetProcurementPoBoardQuery,
	useListProcurementPosQuery,
	useLazyListProcurementPosQuery,
	useCreateProcurementPoMutation,
	useBulkCreateProcurementPosMutation,
	useGetProcurementPoByIdQuery,
	usePatchProcurementPoMutation,
	useDeleteProcurementPoMutation,
} = procurementPoApiSlice;

