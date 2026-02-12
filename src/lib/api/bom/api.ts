import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type BomStatus = "Active" | "Inactive";

export type BackendBomNode = {
  id: string;
  assembly_code?: string;
  uniq?: string;
  part_name?: string;
  part_number?: string;
  qpu?: number;
  version?: string;
  status?: string;
  level?: number;
  image_url?: string;
  children?: BackendBomNode[];
};

export type BomCreateRequest = {
  assembly_code: string;
  uniq?: string;
  part_name: string;
  part_number?: string;
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

export const bomSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBomTree: builder.query<ApiResponse<BackendBomNode[]>, void>({
      query: () => ({
        url: "/api/bom",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseTreeResponse(response)),
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

        // Common fields; backend uses multer so prefer multipart even without image.
        formData.append("assembly_code", body.assembly_code);
        if (body.uniq) formData.append("uniq", body.uniq);
        formData.append("part_name", body.part_name);
        if (body.part_number) formData.append("part_number", body.part_number);
        if (body.status) formData.append("status", body.status);
        if (body.description) formData.append("description", body.description);

        // Complex/nested fields: send as JSON strings (safe even if backend ignores some).
        if (body.process_routes != null) formData.append("process_routes", JSON.stringify(body.process_routes));
        if (body.material_spec != null) formData.append("material_spec", JSON.stringify(body.material_spec));
        if (body.child_parts != null) formData.append("child_parts", JSON.stringify(body.child_parts));

        if (body.imageFile) formData.append("image", body.imageFile);

        return {
          url: "/api/bom",
          method: "POST",
          body: formData,
          meta: { useAuthorization: true, contentType: "multipart/form-data" },
        };
      },
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string }>;
        return ok({ id: r?.id ?? "" }, "Created");
      },
    }),

    updateBom: builder.mutation<ApiResponse<{ id: string }>, { id: string; body: Partial<BomCreateRequest> }>({
      query: ({ id, body }) => {
        const formData = new FormData();

        if (body.assembly_code) formData.append("assembly_code", body.assembly_code);
        if (body.uniq) formData.append("uniq", body.uniq);
        if (body.part_name) formData.append("part_name", body.part_name);
        if (body.part_number) formData.append("part_number", body.part_number);
        if (body.status) formData.append("status", body.status);
        if (body.description) formData.append("description", body.description);
        if (body.process_routes != null) formData.append("process_routes", JSON.stringify(body.process_routes));
        if (body.material_spec != null) formData.append("material_spec", JSON.stringify(body.material_spec));
        if (body.child_parts != null) formData.append("child_parts", JSON.stringify(body.child_parts));
        if (body.imageFile) formData.append("image", body.imageFile);

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
