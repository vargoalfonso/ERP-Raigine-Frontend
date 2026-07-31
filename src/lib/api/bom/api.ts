import { apiBaseUrl, apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type BomStatus = "Active" | "Inactive";

export type BackendBomNode = {
  // New BOM backend fields (best-effort mapped)
  bom_id?: string;
  bom_child_id?: string;
  bom_line_id?: string;
  bom_status?: any;
  uniq_code?: string;
  type_material?: string;
  asset?: string;
  asset_type?: string;
  asset_label?: string;
  cad_viewable?: boolean;
  model?: string;

  description?: any;
  quantity?: any;
  material_code?: any;
  unit_measurement?: any;
  process_routes?: any;
  material_specifications?: any;
  created_at?: any;
  updated_at?: any;
  // Some backends use `uuid` instead of `id`.
  id?: string;
  uuid?: string;
  _id?: string;
  // Some backends return flat lists with parent pointers.
  parent_id?: string | null;
  parentId?: string | null;
  parent_uuid?: string | null;
  parentUuid?: string | null;
  assembly_code?: string;
  uniq?: string;
  part_name?: string;
  part_number?: string;
  qpu?: number;
  version?: string;
  status?: string;
  level?: number;
  image_url?: string;
  // Alternative image fields used by some backends.
  image?: string;
  imageUrl?: string;
  image_path?: string;
  imagePath?: string;
  children?: BackendBomNode[];
};

export type BomCreateRequest = {
  uniq_code: string;
  part_name: string;
  part_number?: string;
  model?: string;
  uom?: string | number;
  uom_id?: string | number;
  item_type?: string;
  qty_per_uniq?: number;
  scrap_factor?: number;
  asset?: string;
  level?: number;
  status?: string;
  description?: string;
  process_routes?: unknown;
  material_spec?: unknown;
  children?: unknown[];
};

export type BomUniqDetail = {
  id: string;
  uniq: string;
  part_name?: string;
  part_number?: string;
  material_code?: string;
  unit_measurement?: string;
  created_at?: string;
  updated_at?: string;
};

export type BomVersionMeta = {
  bom_id: string;
  bom_version: number;
  label?: string;
  bom_status?: string;
  is_current?: boolean;
  read_only?: boolean;
  change_note?: string;
  created_at?: string;
};

export type BomVersionsResponse = {
  root_item_id?: number;
  root_item_code?: string;
  root_item_name?: string;
  current_bom_id?: string;
  current_version?: number;
  versions: BomVersionMeta[];
};

export type ActivateBomRequest = {
  change_note: string;
};

export type BomImportResponse = {
  request_id?: string;
  status?: number | string;
  import_status?: string;
  total?: number;
  imported?: number;
  success_count?: number;
  failed?: number;
  failed_count?: number;
  download_url?: string;
  error_download_url?: string;
  failed_download_url?: string;
  errors?: unknown[];
  validation_errors?: unknown[];
  failed_rows?: unknown[];
  invalid_rows?: unknown[];
  message?: string;
};

export type BomFullAsset = {
  id?: number | string | null;
  url?: string | null;
  asset_type?: string | null;
  label?: string | null;
  cad_viewable?: boolean;
};

export type BomFullProcessRoute = {
  route_id?: number | string;
  op_seq?: number;
  process_id?: number | string;
  process_name?: string | null;
  machine_id?: number | string | null;
  machine_name?: string | null;
  cycle_time_sec?: number | null;
  setup_time_min?: number | null;
  machine_stroke?: string | null;
  tooling_ref?: string | null;
  toolings?: unknown;
};

export type BomFullNode = {
  bom_id?: number | string;
  bom_version?: number;
  is_archived?: boolean;
  uniq_code?: string;
  part_name?: string;
  part_number?: string;
  model?: string | null;
  uom?: string | null;
  status?: string | null;
  description?: string | null;
  asset?: BomFullAsset | null;
  material_spec?: Record<string, unknown> | null;
  process_routes?: BomFullProcessRoute[] | null;
  children?: BomFullNode[];
  child_id?: number | string;
  line_id?: number | string;
  parent_uniq_code?: string;
  level?: number;
  qty_per_uniq?: number;
  scrap_factor?: number;
  is_phantom?: boolean;
};

export type ReplaceBomRequest = {
  bom_id: string;
  payload: Record<string, unknown>;
  files?: Array<{
    key: string;
    file: File;
  }>;
};

export type ImportHistoryDto = {
  id: number | string;
  file_name: string;
  file_size_kb: number;
  row_count: number;
  uploaded_by: string;
  status: string; // "success" | "partial" | "error"
  summary: string;
  imported_count: number;
  failed_count: number;
  request_id: string;
  has_error_file: boolean;
  preview_rows?: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
};

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

export type BomListResponse = {
  items: BackendBomNode[];
  totalPages: number;
  total: number;
  page: number;
};

const parseTreeResponse = (response: unknown): BackendBomNode[] => {
  if (Array.isArray(response)) return response as BackendBomNode[];
  if (response && typeof response === "object") {
    const maybe = (response as Partial<{ data: unknown }>).data;
    if (Array.isArray(maybe)) return maybe as BackendBomNode[];
    if (maybe && typeof maybe === "object") {
      const items = (maybe as Partial<{ items: unknown }>).items;
      if (Array.isArray(items)) return items as BackendBomNode[];
    }
  }
  return [];
};

const parseBomListResponse = (response: unknown): BomListResponse => {
  const empty: BomListResponse = {
    items: [],
    totalPages: 1,
    total: 0,
    page: 1,
  };
  if (!isRecord(response)) return empty;
  const data = isRecord(response.data) ? response.data : response;

  const itemsRaw = isRecord(data) ? (data.items ?? data.data) : undefined;
  const items = Array.isArray(itemsRaw)
    ? (itemsRaw as BackendBomNode[])
    : parseTreeResponse(response);

  const pag =
    isRecord(data) && isRecord(data.pagination) ? data.pagination : null;
  const totalPages = typeof pag?.total_pages === "number" ? pag.total_pages : 1;
  const total = typeof pag?.total === "number" ? pag.total : items.length;
  const page = typeof pag?.page === "number" ? pag.page : 1;

  return { items, totalPages, total, page };
};

const parseArrayResponse = (response: unknown): unknown[] => {
  if (Array.isArray(response)) return response as unknown[];
  if (response && typeof response === "object") {
    const maybe = (response as Partial<{ data: unknown }>).data;
    if (Array.isArray(maybe)) return maybe as unknown[];
    if (maybe && typeof maybe === "object") {
      const nested = (maybe as Partial<{ data: unknown }>).data;
      if (Array.isArray(nested)) return nested as unknown[];
    }
  }
  return [];
};

const toBomUniqDetail = (raw: unknown): BomUniqDetail => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = String(r.id ?? r.uuid ?? "").trim();
  const uniq = String(r.uniq ?? "").trim();
  return {
    id,
    uniq,
    part_name: typeof r.part_name === "string" ? r.part_name : undefined,
    part_number: typeof r.part_number === "string" ? r.part_number : undefined,
    material_code:
      typeof r.material_code === "string" ? r.material_code : undefined,
    unit_measurement:
      typeof r.unit_measurement === "string" ? r.unit_measurement : undefined,
    created_at: typeof r.created_at === "string" ? r.created_at : undefined,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : undefined,
  };
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object";

const pickString = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
};

const resolveMaybeRelativeUrl = (url: string): string => {
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  // /uploads/ paths are proxied via Next.js rewrites in next.config.ts — use as-is
  if (u.startsWith("/uploads/")) return u;
  if (!apiBaseUrl) return u;
  if (u.startsWith("/")) return `${apiBaseUrl}${u}`;
  return `${apiBaseUrl}/${u}`;
};

const pickAssetUrl = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    for (const item of v) {
      const u = pickAssetUrl(item);
      if (u) return u;
    }
  }
  if (v && typeof v === "object") {
    const direct =
      (v as any)?.url ??
      (v as any)?.path ??
      (v as any)?.file_url ??
      (v as any)?.fileUrl ??
      (v as any)?.asset_url ??
      (v as any)?.assetUrl;
    if (typeof direct === "string") return direct.trim();

    const nested = (v as any)?.file ?? (v as any)?.asset;
    if (nested) {
      const u = pickAssetUrl(nested);
      if (u) return u;
    }
  }
  return "";
};

const normalizeStatusToLabel = (v: unknown): BomStatus => {
  const s = pickString(v).toLowerCase();
  return s === "inactive" ? "Inactive" : "Active";
};

const mapNewNodeToLegacy = (raw: unknown): BackendBomNode => {
  if (!isRecord(raw))
    return {
      description: null,
      quantity: null,
      material_code: null,
      unit_measurement: null,
      process_routes: null,
      material_specifications: null,
      created_at: null,
      updated_at: null,
    };

  const uniqCode = pickString(raw.uniq_code);
  const uniq = pickString(raw.uniq) || uniqCode;
  const partName = pickString(raw.part_name);
  const partNumber = pickString(raw.part_number);
  const model =
    pickString(raw.model) ||
    pickString((raw as any).product_model) ||
    pickString(raw.assembly_code);

  const childrenRaw = raw.children;
  const children = Array.isArray(childrenRaw)
    ? childrenRaw.map(mapNewNodeToLegacy)
    : undefined;

  // Keep both new + legacy field names so existing pages continue working.
  const mapped: BackendBomNode = {
    description: raw.description ?? null,
    quantity: raw.quantity ?? raw.qpu ?? raw.qty_per_uniq ?? null,
    material_code: raw.material_code ?? null,
    unit_measurement: raw.unit_measurement ?? (raw as any).uom ?? null,
    process_routes: raw.process_routes ?? null,
    material_specifications:
      raw.material_spec ?? raw.material_specifications ?? null,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,

    bom_status: (raw as any).bom_status,

    // IMPORTANT: bom_id must NOT fall back to internal id.
    // Some endpoints return both { bom_id, id }, where id is an internal row id.
    bom_id:
      pickString(raw.bom_id) ||
      pickString((raw as any).bomId) ||
      pickString((raw as any).bomID),
    bom_child_id: pickString(raw.bom_child_id),
    bom_line_id: pickString(raw.bom_line_id),
    uniq_code: uniqCode || uniq,
    asset: resolveMaybeRelativeUrl(
      pickAssetUrl(raw.asset) ||
        pickString((raw as any).asset_url) ||
        pickString((raw as any).assetUrl) ||
        pickString(raw.image_url) ||
        pickString(raw.image) ||
        pickString(raw.imageUrl) ||
        pickString(raw.image_path) ||
        pickString(raw.imagePath),
    ),
    asset_type: (() => {
      const a = raw.asset;
      if (a && typeof a === "object")
        return pickString((a as any).asset_type) || undefined;
      return undefined;
    })(),
    asset_label: (() => {
      const a = raw.asset;
      if (a && typeof a === "object")
        return pickString((a as any).label) || undefined;
      return undefined;
    })(),
    cad_viewable: (() => {
      const a = raw.asset;
      if (a && typeof a === "object") return Boolean((a as any).cad_viewable);
      return false;
    })(),

    id: pickString(raw.id) || pickString(raw.uuid) || pickString(raw._id),
    uuid: pickString(raw.uuid),
    _id: pickString(raw._id),
    parent_id: raw.parent_id as any,
    parentId: raw.parentId as any,
    parent_uuid: raw.parent_uuid as any,
    parentUuid: raw.parentUuid as any,
    assembly_code: pickString(raw.assembly_code) || model,
    uniq,
    part_name: partName,
    part_number: partNumber,
    model,
    qpu:
      typeof raw.qpu === "number"
        ? raw.qpu
        : typeof raw.qty_per_uniq === "number"
          ? raw.qty_per_uniq
          : typeof raw.quantity === "number"
            ? raw.quantity
            : undefined,
    version: pickString(raw.version),
    status: pickString(raw.status) || normalizeStatusToLabel(raw.status),
    level: typeof raw.level === "number" ? raw.level : undefined,
    image_url: resolveMaybeRelativeUrl(
      pickString(raw.image_url) ||
        pickString((raw as any).asset_url) ||
        pickString((raw as any).assetUrl) ||
        pickAssetUrl(raw.asset),
    ),
    image: pickString(raw.image),
    imageUrl: pickString(raw.imageUrl),
    image_path: pickString(raw.image_path),
    imagePath: pickString(raw.imagePath),
    type_material:
      pickString((raw as any).type_material) ||
      pickString((raw as any).material_spec?.type_material) ||
      undefined,
    children,
  };

  return mapped;
};

const pickNodeId = (n: BackendBomNode): string => {
  const v =
    (typeof n.id === "string" ? n.id : undefined) ??
    (typeof n.uuid === "string" ? n.uuid : undefined) ??
    (typeof n._id === "string" ? n._id : undefined);
  return String(v ?? "").trim();
};

const pickParentId = (n: BackendBomNode): string => {
  const v =
    (typeof n.parent_id === "string" ? n.parent_id : undefined) ??
    (typeof n.parentId === "string" ? n.parentId : undefined) ??
    (typeof n.parent_uuid === "string" ? n.parent_uuid : undefined) ??
    (typeof n.parentUuid === "string" ? n.parentUuid : undefined);
  return String(v ?? "").trim();
};

const buildTreeIfFlat = (nodes: BackendBomNode[]): BackendBomNode[] => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  // If backend already sends nested children, keep as-is.
  const alreadyTree = nodes.some(
    (n) => Array.isArray(n.children) && n.children.length > 0,
  );
  if (alreadyTree) return nodes;

  const hasParentPointers = nodes.some((n) => pickParentId(n));
  if (!hasParentPointers) return nodes;

  const byId = new Map<string, BackendBomNode>();
  const clones = nodes.map((n) => ({
    ...n,
    id: pickNodeId(n),
    children: [] as BackendBomNode[],
  }));
  for (const n of clones) {
    const id = pickNodeId(n);
    if (id) byId.set(id, n);
  }

  const roots: BackendBomNode[] = [];
  for (const n of clones) {
    const pid = pickParentId(n);
    const parent = pid ? byId.get(String(pid)) : undefined;
    if (parent) parent.children!.push(n);
    else roots.push(n);
  }
  return roots;
};

const pickId = (...values: unknown[]): string => {
  for (const v of values) {
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s && s !== "0") return s;
    }
  }
  return "";
};

const parseBomVersions = (response: unknown): BomVersionsResponse => {
  const base: BomVersionsResponse = { versions: [] };
  if (!isRecord(response)) return base;
  const data = isRecord(response.data) ? response.data : response;

  const versionsRaw = (data as any).versions;
  const versions: BomVersionMeta[] = Array.isArray(versionsRaw)
    ? versionsRaw.flatMap((v: any) => {
        const bom_id = pickId(v?.bom_id, v?.bomId, v?.id);
        const bom_version =
          typeof v?.bom_version === "number"
            ? v.bom_version
            : Number(v?.bom_version);
        if (!bom_id || !Number.isFinite(bom_version)) return [];
        const item: BomVersionMeta = {
          bom_id: String(bom_id),
          bom_version,
          label: typeof v?.label === "string" ? v.label : undefined,
          bom_status:
            typeof v?.bom_status === "string" ? v.bom_status : undefined,
          is_current: Boolean(v?.is_current),
          read_only:
            typeof v?.read_only === "boolean" ? v.read_only : undefined,
          change_note:
            typeof v?.change_note === "string" ? v.change_note : undefined,
          created_at:
            typeof v?.created_at === "string" ? v.created_at : undefined,
        };
        return [item];
      })
    : [];

  const current_bom_id = pickId(
    (data as any).current_bom_id,
    (data as any).currentBomId,
  );
  const current_version_raw = (data as any).current_version;
  const current_version =
    typeof current_version_raw === "number"
      ? current_version_raw
      : Number.isFinite(Number(current_version_raw))
        ? Number(current_version_raw)
        : undefined;

  return {
    root_item_id:
      typeof (data as any).root_item_id === "number"
        ? (data as any).root_item_id
        : undefined,
    root_item_code:
      typeof (data as any).root_item_code === "string"
        ? (data as any).root_item_code
        : undefined,
    root_item_name:
      typeof (data as any).root_item_name === "string"
        ? (data as any).root_item_name
        : undefined,
    current_bom_id: current_bom_id || undefined,
    current_version,
    versions,
  };
};

const parseActivateResponse = (
  response: unknown,
): { current_bom_id?: string } => {
  if (!isRecord(response)) return {};
  const data = isRecord(response.data) ? response.data : response;
  const current = pickId(
    (data as any).current_bom_id,
    (data as any).currentBomId,
    (data as any).bom_id,
  );
  return current ? { current_bom_id: current } : {};
};

const parseCreateIds = (response: unknown): { id: string; bom_id: string } => {
  const empty = { id: "", bom_id: "" };
  if (!isRecord(response)) return empty;
  const data = isRecord(response.data) ? response.data : response;
  // `id` = item ID (used for upload sessions)
  // `bom_id` = BOM header ID (used for BOM GET/UPDATE URLs)
  return {
    id: pickId(data.id, data.uuid),
    bom_id: pickId(data.bom_id, data.id, data.uuid),
  };
};

const parseCreateId = (response: unknown): string =>
  parseCreateIds(response).id;

// ReplaceBom returns { new_bom_id, old_bom_id, ... } — NOT { bom_id, id }.
// The new version lives under a brand new bom_id, so the edit page must redirect there.
const parseReplaceIds = (
  response: unknown,
): { id: string; bom_id: string; new_bom_id: string; old_bom_id: string } => {
  const empty = { id: "", bom_id: "", new_bom_id: "", old_bom_id: "" };
  if (!isRecord(response)) return empty;
  const data = isRecord(response.data) ? response.data : response;
  const newId = pickId(
    (data as any).new_bom_id,
    (data as any).newBomId,
    data.bom_id,
    data.id,
    data.uuid,
  );
  const oldId = pickId((data as any).old_bom_id, (data as any).oldBomId);
  return { id: newId, bom_id: newId, new_bom_id: newId, old_bom_id: oldId };
};

const BOM_TAG = { type: "BOM" as const, id: "TREE" as const };

export const bomSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBomTree: builder.query<
      ApiResponse<BomListResponse>,
      {
        page?: number;
        limit?: number;
        search?: string;
        type_material?: string;
        exclude_supplier_uuid?: string;
      } | void
    >({
      query: (params) => {
        const page = params?.page ?? 1;
        // Backend clamps any limit > 200 down to 20; request the max allowed.
        const limit = Math.min(1000, params?.limit ?? 1000);
        const searchParams = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (params?.search) searchParams.set("search", params.search);
        if (params?.type_material)
          searchParams.set("type_material", params.type_material);
        if (params?.exclude_supplier_uuid)
          searchParams.set(
            "exclude_supplier_uuid",
            params.exclude_supplier_uuid,
          );

        return {
          url: `/products/bom?${searchParams.toString()}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => {
        const parsed = parseBomListResponse(response);
        const mapped = parsed.items.map(mapNewNodeToLegacy);
        return ok({
          items: buildTreeIfFlat(mapped),
          totalPages: parsed.totalPages,
          total: parsed.total,
          page: parsed.page,
        });
      },
      providesTags: [BOM_TAG],
    }),

    getBomList: builder.query<
      ApiResponse<BackendBomNode[]>,
      { page?: number; limit?: number } | void
    >({
      // The backend clamps any limit > 200 back down to its default of 20, so a
      // single large request only ever returns ~20 rows (2 pages of 10 in the
      // table). Page through the list at the max allowed limit (200) and
      // accumulate every row so the table paginates over the full dataset.
      async queryFn(params, _api, _extraOptions, fetchWithBQ) {
        const limit = Math.min(200, params?.limit ?? 200);
        const all: BackendBomNode[] = [];
        let page = 1;
        const maxPages = 500; // safety cap: 500 * 200 = 100,000 rows

        while (page <= maxPages) {
          const searchParams = new URLSearchParams({
            page: String(page),
            limit: String(limit),
          });
          const result = await fetchWithBQ({
            url: `/products/bom?${searchParams.toString()}`,
            method: "GET",
            meta: { useAuthorization: true, contentType: "application/json" },
          });
          if (result.error) return { error: result.error };

          const parsed = parseBomListResponse(result.data);
          all.push(...parsed.items);

          // Prefer the backend's own page count when present; otherwise fall
          // back to stopping once a short (final) page comes back.
          const knownTotalPages =
            parsed.totalPages && parsed.totalPages > 0
              ? parsed.totalPages
              : null;
          const reachedLastPage = knownTotalPages
            ? page >= knownTotalPages
            : parsed.items.length < limit;
          if (reachedLastPage) break;
          page += 1;
        }

        const mapped = all.map(mapNewNodeToLegacy);
        return { data: ok(buildTreeIfFlat(mapped)) };
      },
      providesTags: [BOM_TAG],
    }),

    getBomsBySupplier: builder.query<
      ApiResponse<BackendBomNode[]>,
      { supplier_id: string; uniq_code?: string; page?: number }
    >({
      query: ({ supplier_id, uniq_code, page = 1 }) => {
        const params = new URLSearchParams({ page: String(page), supplier_id });
        if (uniq_code) params.set("uniq_code", uniq_code);
        return {
          url: `/products/bom?${params.toString()}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => {
        const arr = parseTreeResponse(response);
        const mapped = arr.map(mapNewNodeToLegacy);
        return ok(buildTreeIfFlat(mapped));
      },
    }),

    getBomById: builder.query<ApiResponse<BackendBomNode>, string>({
      query: (id) => ({
        url: `/products/bom/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        if (response && typeof response === "object") {
          const data = (response as Partial<{ data: unknown }>).data;
          return ok(mapNewNodeToLegacy(data ?? response));
        }
        return ok(mapNewNodeToLegacy(response));
      },
    }),

    getBomFullById: builder.query<ApiResponse<BomFullNode>, string>({
      query: (id) => ({
        url: `/products/bom/${encodeURIComponent(id)}/full`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        if (response && typeof response === "object") {
          const data = (response as Partial<{ data: unknown }>).data;
          return ok(((data ?? response) as BomFullNode) ?? {});
        }
        return ok((response as BomFullNode | undefined) ?? {});
      },
    }),

    getBomVersions: builder.query<ApiResponse<BomVersionsResponse>, string>({
      query: (bomId) => ({
        url: `/products/bom/${encodeURIComponent(bomId)}/versions`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseBomVersions(response)),
    }),

    getImportHistory: builder.query<ApiResponse<ImportHistoryDto[]>, void>({
      query: () => ({
        url: `/products/bom/import/history`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const data = (response as { data?: ImportHistoryDto[] })?.data;
        return ok(Array.isArray(data) ? data : []);
      },
    }),

    activateBom: builder.mutation<
      ApiResponse<{ current_bom_id?: string }>,
      { bom_id: string; body: ActivateBomRequest }
    >({
      query: ({ bom_id, body }) => ({
        url: `/products/bom/${encodeURIComponent(bom_id)}/activate`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok(parseActivateResponse(response), "OK"),
      invalidatesTags: [BOM_TAG],
    }),

    createBom: builder.mutation<
      ApiResponse<{ id: string; bom_id: string }>,
      BomCreateRequest
    >({
      query: (body) => ({
        url: "/products/bom",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok(parseCreateIds(response), "Created"),
      invalidatesTags: [BOM_TAG],
    }),

    importBom: builder.mutation<ApiResponse<BomImportResponse>, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file, file.name);

        return {
          url: "/products/bom/import",
          method: "POST",
          body: formData,
          meta: { useAuthorization: true, contentType: "multipart/form-data" },
        };
      },
      transformResponse: (response: unknown) => {
        const data =
          response && typeof response === "object" && "data" in response
            ? ((response as { data?: BomImportResponse }).data ?? {})
            : ((response as BomImportResponse | undefined) ?? {});
        return ok(data, "Imported");
      },
      invalidatesTags: [BOM_TAG],
    }),

    updateBom: builder.mutation<
      ApiResponse<{ id: string }>,
      { bom_id: string; body: Partial<BomCreateRequest> }
    >({
      query: ({ bom_id, body }) => ({
        url: `/products/bom/${encodeURIComponent(bom_id)}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok({ id: parseCreateId(response) }, "Updated"),
      invalidatesTags: [BOM_TAG],
    }),

    replaceBom: builder.mutation<
      ApiResponse<{
        id: string;
        bom_id: string;
        new_bom_id: string;
        old_bom_id: string;
      }>,
      ReplaceBomRequest
    >({
      query: ({ bom_id, payload, files = [] }) => {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(payload));
        for (const entry of files) {
          if (!entry?.key || !(entry.file instanceof File)) continue;
          formData.append(entry.key, entry.file, entry.file.name);
        }

        return {
          url: `/products/bom/${encodeURIComponent(bom_id)}/replace`,
          method: "POST",
          body: formData,
          meta: { useAuthorization: true, contentType: "multipart/form-data" },
        };
      },
      transformResponse: (response: unknown) =>
        ok(parseReplaceIds(response), "Updated"),
      invalidatesTags: [BOM_TAG],
    }),

    deleteBomParent: builder.mutation<
      ApiResponse<{ id: string }>,
      { bom_id: string }
    >({
      query: ({ bom_id }) => ({
        url: `/products/bom/${encodeURIComponent(bom_id)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok({ id: parseCreateId(response) }, "Deleted"),
      invalidatesTags: [BOM_TAG],
    }),

    deleteBomChild: builder.mutation<
      ApiResponse<{ id: string }>,
      { bom_id: string; bom_child_id: string }
    >({
      query: ({ bom_id, bom_child_id }) => ({
        url: `/products/bom/${encodeURIComponent(bom_id)}/children/${encodeURIComponent(bom_child_id)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok({ id: parseCreateId(response) }, "Deleted"),
      invalidatesTags: [BOM_TAG],
    }),

    deleteBomLine: builder.mutation<
      ApiResponse<{ id: string }>,
      { bom_id: string; bom_child_id: string; bom_line_id: string }
    >({
      query: ({ bom_id, bom_child_id, bom_line_id }) => ({
        url: `/products/bom/${encodeURIComponent(bom_id)}/children/${encodeURIComponent(bom_child_id)}/lines/${encodeURIComponent(bom_line_id)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok({ id: parseCreateId(response) }, "Deleted"),
      invalidatesTags: [BOM_TAG],
    }),

    updateBomLine: builder.mutation<
      ApiResponse<{ id: string }>,
      {
        bom_id: string;
        bom_child_id: string;
        bom_line_id: string;
        body: Record<string, unknown>;
      }
    >({
      query: ({ bom_id, bom_child_id, bom_line_id, body }) => ({
        url: `/products/bom/${encodeURIComponent(bom_id)}/children/${encodeURIComponent(bom_child_id)}/lines/${encodeURIComponent(bom_line_id)}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok({ id: parseCreateId(response) }, "Updated"),
      invalidatesTags: [BOM_TAG],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetBomTreeQuery,
  useGetBomListQuery,
  useGetBomsBySupplierQuery,
  useGetBomByIdQuery,
  useGetBomFullByIdQuery,
  useLazyGetBomFullByIdQuery,
  useGetBomVersionsQuery,
  useActivateBomMutation,
  useCreateBomMutation,
  useImportBomMutation,
  useGetImportHistoryQuery,
  useUpdateBomMutation,
  useReplaceBomMutation,
  useDeleteBomParentMutation,
  useDeleteBomChildMutation,
  useDeleteBomLineMutation,
  useUpdateBomLineMutation,
} = bomSlice;
