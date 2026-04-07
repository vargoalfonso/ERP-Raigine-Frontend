import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse, DataObject } from "@/types";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

export type MasterDropdownItem = { id: string; name?: string };
export type MasterWarehouseItem = { id: string; code?: string };
export type MasterRmUniqItem = {
	id: string;
	code?: string;
	name?: string;
	notes?: string | null;
	rm_type_id?: string | null;
	unit_measurement_id?: string | null;
	default_weight?: number | null;
};

export type MasterDropdownResponse = {
	rmTypes: MasterDropdownItem[];
	rmSources: MasterDropdownItem[];
	warehouses: MasterWarehouseItem[];
	unitMeasurements: MasterDropdownItem[];
	rmUniqs: MasterRmUniqItem[];
	suppliers: unknown[];
};

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
	message,
	status: "success",
	data,
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const pickFirstString = (r: Record<string, unknown>, keys: string[]) => {
	for (const k of keys) {
		const v = r[k];
		if (typeof v === "string" && v.trim().length > 0) return v;
	}
	return "";
};

const toNumberOrNull = (value: unknown): number | null | undefined => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim().length > 0) {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
	}
	if (value == null) return null;
	return undefined;
};

const toIdName = (raw: unknown): MasterDropdownItem => {
	const r = (raw ?? {}) as Record<string, unknown>;
	return {
		id: String(
			pickFirstString(r, ["rm_type_id", "rm_source_id", "unit_measurement_id", "warehouse_id", "rm_uniq_id", "id", "uuid"]) ??
			""
		),
		name: typeof r.name === "string" ? r.name : undefined,
	};
};

const toWarehouse = (raw: unknown): MasterWarehouseItem => {
	const r = (raw ?? {}) as Record<string, unknown>;
	return {
		id: String(pickFirstString(r, ["warehouse_id", "id", "uuid"]) ?? ""),
		code: typeof r.code === "string" ? r.code : undefined,
	};
};

const toRmUniq = (raw: unknown): MasterRmUniqItem => {
	const r = (raw ?? {}) as Record<string, unknown>;
	return {
		id: String(pickFirstString(r, ["rm_uniq_id", "id", "uuid"]) ?? ""),
		code: typeof r.code === "string" ? r.code : undefined,
		name: typeof r.name === "string" ? r.name : undefined,
		notes: typeof r.notes === "string" ? r.notes : (r.notes == null ? null : undefined),
		rm_type_id: typeof r.rm_type_id === "string" ? r.rm_type_id : (r.rm_type_id == null ? null : undefined),
		unit_measurement_id:
			typeof r.unit_measurement_id === "string" ? r.unit_measurement_id : (r.unit_measurement_id == null ? null : undefined),
		default_weight: toNumberOrNull(r.default_weight),
	};
};

export const masterApiSlice = apiSlice.injectEndpoints({
	endpoints: (builder) => ({
		getMasterDropdown: builder.query<ApiResponse<DataObject<MasterDropdownResponse>>, void>({
			query: () => ({
				url: "/api/master",
				method: "GET",
				meta: { useAuthorization: true, contentType: "application/json" },
			}),
			transformResponse: (response: unknown) => {
				const unwrapped = unwrapBackendData<unknown>(response);
				const root = (isRecord(unwrapped) ? unwrapped : {}) as Record<string, unknown>;

				const rmTypes = Array.isArray(root.rmTypes) ? root.rmTypes.map(toIdName) : [];
				const rmSources = Array.isArray(root.rmSources) ? root.rmSources.map(toIdName) : [];
				const warehouses = Array.isArray(root.warehouses) ? root.warehouses.map(toWarehouse) : [];
				const unitMeasurements = Array.isArray(root.unitMeasurements) ? root.unitMeasurements.map(toIdName) : [];
				const rmUniqs = Array.isArray(root.rmUniqs) ? root.rmUniqs.map(toRmUniq) : [];
				const suppliers = Array.isArray(root.suppliers) ? root.suppliers : [];

				return ok({ rmTypes, rmSources, warehouses, unitMeasurements, rmUniqs, suppliers });
			},
		}),
	}),
});

export const { useGetMasterDropdownQuery } = masterApiSlice;
