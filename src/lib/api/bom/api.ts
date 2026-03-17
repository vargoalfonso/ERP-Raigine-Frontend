import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type BomStatus = "Active" | "Inactive";

export type BackendBomNode = {
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
  assembly_code: string;
  uniq?: string;
  part_name: string;
  part_number?: string;
  qpu?: number;
  // Some backends use `quantity` instead of `qpu`
  quantity?: number;
  version?: string;
  // Link to parent BOM item (UUID/id) for child parts.
  parent_id?: string;
  status?: BomStatus;
  description?: string;
  process_routes?: unknown;
  material_spec?: unknown;
  child_parts?: unknown;
  imageFile?: File | null;
};

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

const parseTreeResponse = (response: unknown): BackendBomNode[] => {
  if (Array.isArray(response)) return response as BackendBomNode[];
  if (response && typeof response === "object") {
    const maybe = (response as Partial<{ data: unknown }>).data;
    if (Array.isArray(maybe)) return maybe as BackendBomNode[];
  }
  return [];
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
  const alreadyTree = nodes.some((n) => Array.isArray(n.children) && n.children.length > 0);
  if (alreadyTree) return nodes;

  const hasParentPointers = nodes.some((n) => pickParentId(n));
  if (!hasParentPointers) return nodes;

  const byId = new Map<string, BackendBomNode>();
  const clones = nodes.map((n) => ({ ...n, id: pickNodeId(n), children: [] as BackendBomNode[] }));
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

const parseCreateId = (response: unknown): string => {
  if (response && typeof response === "object") {
    const r = response as Partial<{ id: unknown; uuid: unknown; data: unknown }>;
    if (typeof r.id === "string") return r.id;
    if (typeof r.uuid === "string") return r.uuid;
    if (r.data && typeof r.data === "object") {
      const d = r.data as Partial<{ id: unknown; uuid: unknown; data: unknown }>;
      if (typeof d.id === "string") return d.id;
      if (typeof d.uuid === "string") return d.uuid;
      if (d.data && typeof d.data === "object") {
        const dd = d.data as Partial<{ id: unknown; uuid: unknown }>;
        if (typeof dd.id === "string") return dd.id;
        if (typeof dd.uuid === "string") return dd.uuid;
      }
    }
  }
  return "";
};

const appendImageFile = (formData: FormData, file: File) => {
  // Most multer setups expect a single file field name, commonly `image`.
  // Sending multiple file fields can cause server-side "Unexpected field" errors.
  formData.append("image", file);
};

export const bomSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBomTree: builder.query<ApiResponse<BackendBomNode[]>, void>({
      query: () => ({
        url: "/api/bom",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const arr = parseTreeResponse(response);
        return ok(buildTreeIfFlat(arr));
      },
    }),

    getBomById: builder.query<ApiResponse<BackendBomNode>, string>({
      query: (id) => ({
        url: `/api/bom/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(response as BackendBomNode),
    }),

    getBomAssemblyCodes: builder.query<ApiResponse<string[]>, void>({
      query: () => ({
        url: "/api/bom/assembly-codes",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const arr = Array.isArray(response) ? (response as unknown[]) : [];
        const codes = arr.map(String);
        return ok(codes);
      },
    }),

    getBomUniqs: builder.query<ApiResponse<string[]>, { assembly_code: string }>({
      query: ({ assembly_code }) => ({
        url: `/api/bom/uniqs?assembly_code=${encodeURIComponent(assembly_code)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const arr = Array.isArray(response) ? (response as unknown[]) : [];
        const uniqs = arr.map(String);
        return ok(uniqs);
      },
    }),

    createBom: builder.mutation<ApiResponse<{ id: string }>, BomCreateRequest>({
      query: (body) => {
        const formData = new FormData();

        // Backend expects multipart/form-data for create
        formData.append("assembly_code", body.assembly_code);
        if (body.uniq) formData.append("uniq", body.uniq);
        formData.append("part_name", body.part_name);
        if (body.part_number) formData.append("part_number", body.part_number);
        if (body.version) formData.append("version", body.version);
        const qpu = body.qpu ?? body.quantity;
        if (typeof qpu === "number" && Number.isFinite(qpu)) {
          // Send both names for compatibility
          formData.append("qpu", String(qpu));
          formData.append("quantity", String(qpu));
        }
        if (body.parent_id) formData.append("parent_id", body.parent_id);
        if (body.status) formData.append("status", body.status);
        if (body.description) formData.append("description", body.description);

        if (body.process_routes != null) formData.append("process_routes", JSON.stringify(body.process_routes));
        if (body.material_spec != null) formData.append("material_spec", JSON.stringify(body.material_spec));
        if (body.child_parts != null) formData.append("child_parts", JSON.stringify(body.child_parts));

        if (body.imageFile) appendImageFile(formData, body.imageFile);

        return {
          url: "/api/bom",
          method: "POST",
          body: formData,
          meta: { useAuthorization: true, contentType: "multipart/form-data" },
        };
      },
      transformResponse: (response: unknown) => {
        return ok({ id: parseCreateId(response) }, "Created");
      },
    }),

    updateBom: builder.mutation<ApiResponse<{ id: string }>, { id: string; body: Partial<BomCreateRequest> }>({
      query: ({ id, body }) => {
        const formData = new FormData();

        if (body.assembly_code) formData.append("assembly_code", body.assembly_code);
        if (body.uniq) formData.append("uniq", body.uniq);
        if (body.part_name) formData.append("part_name", body.part_name);
        if (body.part_number) formData.append("part_number", body.part_number);
        if (body.version) formData.append("version", body.version);
        const qpu = body.qpu ?? body.quantity;
        if (typeof qpu === "number" && Number.isFinite(qpu)) {
          formData.append("qpu", String(qpu));
          formData.append("quantity", String(qpu));
        }
        if (body.parent_id) formData.append("parent_id", body.parent_id);
        if (body.status) formData.append("status", body.status);
        if (body.description) formData.append("description", body.description);
        if (body.process_routes != null) formData.append("process_routes", JSON.stringify(body.process_routes));
        if (body.material_spec != null) formData.append("material_spec", JSON.stringify(body.material_spec));
        if (body.child_parts != null) formData.append("child_parts", JSON.stringify(body.child_parts));
        if (body.imageFile) appendImageFile(formData, body.imageFile);

        return {
          url: `/api/bom/${id}`,
          method: "PUT",
          body: formData,
          meta: { useAuthorization: true, contentType: "multipart/form-data" },
        };
      },
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Updated");
      },
    }),

    deleteBom: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/api/bom/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string }>;
        return ok({ id: r?.id ?? "" }, "Deleted");
      },
    }),
  }),
});

export const {
  useGetBomTreeQuery,
  useGetBomByIdQuery,
  useGetBomAssemblyCodesQuery,
  useGetBomUniqsQuery,
  useCreateBomMutation,
  useUpdateBomMutation,
  useDeleteBomMutation,
} = bomSlice;
