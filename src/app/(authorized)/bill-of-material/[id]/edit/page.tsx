"use client";

import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useParams, useRouter } from "next/navigation";
import { Alert, Card, Form, Input, Spin, Typography, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";

import BomDetailPanel from "@/components/bom-edit/BomDetailPanel";
import BomEditHeader from "@/components/bom-edit/BomEditHeader";
import BomStructurePanel from "@/components/bom-edit/BomStructurePanel";
import type {
  BomSelectedNodePath,
  ChildPartForm,
  EditValues,
  MaterialSpecForm,
  ProcessRouteForm,
} from "@/components/bom-edit/bom-edit.types";
import {
  buildBomTreeItems,
  getChildAtPath,
  keyToChildPath,
  toChildFileKey,
} from "@/components/bom-edit/bom-edit.utils";
import {
  useGetBomFullByIdQuery,
  useGetBomVersionsQuery,
  useReplaceBomMutation,
} from "@/lib/api/bom/api";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetMachinesQuery } from "@/lib/api/machines/api";
import { useGetProcessesQuery, useGetUomsQuery } from "@/lib/api/system-settings/api";

const { Text } = Typography;

const MAX_CHILDREN_PER_PARENT = 6;

const toNumberId = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }
  return undefined;
};

const cleanText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const cleanNullableText = (value: unknown): string | null => cleanText(value) ?? null;

const asFile = (value: unknown): File | null => (value instanceof File ? value : null);

const normalizeMaterialForm = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const allowed = new Set(["Plate", "Coil", "Pipe", "Rod", "Wire", "Other"]);
  if (allowed.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === "sheet" || lower === "plate") return "Plate";
  if (lower === "round bar" || lower === "rod") return "Rod";
  if (lower === "pipe") return "Pipe";
  if (lower === "coil") return "Coil";
  if (lower === "wire") return "Wire";
  if (lower === "other") return "Other";
  return undefined;
};

const resolveAssetUrl = (url: unknown): string => {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (!apiBaseUrl) return trimmed;
  if (trimmed.startsWith("/")) return `${apiBaseUrl}${trimmed}`;
  return `${apiBaseUrl}/${trimmed}`;
};

const createDefaultChild = (): ChildPartForm => ({
  qty_per_uniq: 1,
  scrap_factor: 0,
  is_phantom: false,
  process_routes: [],
  material_spec: {},
  children: [],
});

export default function BomEditPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<EditValues>();
  const [selectedNodeKey, setSelectedNodeKey] = useState<BomSelectedNodePath>("parent");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [childFileLists, setChildFileLists] = useState<Record<string, UploadFile[]>>({});

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const queryArg = apiEnabled && id ? id : skipToken;

  const { data, isLoading, error } = useGetBomFullByIdQuery(queryArg);
  const { data: versionsRes } = useGetBomVersionsQuery(queryArg);
  const [replaceBom, replaceState] = useReplaceBomMutation();

  const { data: processes = [], isLoading: isProcessesLoading } =
    useGetProcessesQuery(undefined, { skip: !apiEnabled });
  const { data: machines = [], isLoading: isMachinesLoading } =
    useGetMachinesQuery(undefined, { skip: !apiEnabled });
  const {
    data: uoms = [],
    isLoading: isUomsLoading,
    error: uomsError,
  } = useGetUomsQuery(undefined, { skip: !apiEnabled });

  const bom = (data as any)?.data ?? data;
  // `preserve: true` is required so useWatch returns the FULL form store
  // (getFieldsValue(true)) including child_parts nodes that aren't currently
  // mounted as Form.Items — otherwise the BOM structure tree renders empty.
  const valuesSnapshot = Form.useWatch([], { form, preserve: true }) as EditValues | undefined;
  const watchedPartName = Form.useWatch("part_name", form);
  const watchedParentProcessRoutes = Form.useWatch("process_routes", form);
  const existingParentAssetUrl = resolveAssetUrl(Form.useWatch("asset_url", form));
  const rootUniq = String(Form.useWatch("parent_uniq", form) ?? "").trim();
  const currentStatus = String(Form.useWatch("status", form) ?? "").trim();

  const titlePartName = useMemo(() => {
    if (typeof watchedPartName === "string" && watchedPartName.trim()) {
      return watchedPartName.trim();
    }
    const bomPartName = (bom as any)?.part_name;
    return typeof bomPartName === "string" && bomPartName.trim() ? bomPartName.trim() : "";
  }, [bom, watchedPartName]);

  const canonicalBomId = useMemo(() => {
    const bomId = (bom as any)?.bom_id;
    if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
    if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
    return id;
  }, [bom, id]);

  const resolvedBomId = canonicalBomId ?? id ?? "";

  const versionsData = (versionsRes as any)?.data ?? versionsRes;
  const currentBomIdRaw = (versionsData as any)?.current_bom_id;
  const currentBomId =
    typeof currentBomIdRaw === "number" && Number.isFinite(currentBomIdRaw)
      ? String(currentBomIdRaw)
      : typeof currentBomIdRaw === "string" && currentBomIdRaw.trim()
        ? currentBomIdRaw.trim()
        : "";

  const isLatest = useMemo(() => {
    if (!currentBomId) return true;
    return String(resolvedBomId) === String(currentBomId);
  }, [currentBomId, resolvedBomId]);

  useEffect(() => {
    if (canonicalBomId && id && canonicalBomId !== id) {
      router.replace(`/bill-of-material/${encodeURIComponent(canonicalBomId)}/edit`);
    }
  }, [canonicalBomId, id, router]);

  const processOptions = useMemo<Array<{ value: string | number; label: string; isAssembly: boolean }>>(() => {
    return (processes ?? [])
      .map((p: any) => {
        const rawId = p?.id ?? p?.ID;
        const idStr = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
        if (!idStr) return null;
        const asNumber = Number(idStr);
        const value: string | number = Number.isFinite(asNumber) ? asNumber : idStr;
        const code = String(p?.process_code ?? p?.ProcessCode ?? "").trim();
        const name = String(p?.process_name ?? p?.ProcessName ?? "").trim();
        return {
          value,
          label: code && name ? `${code} — ${name}` : name || code || idStr,
          isAssembly: Boolean(p?.is_assembly ?? p?.IsAssembly),
        };
      })
      .filter(
        (item): item is { value: string | number; label: string; isAssembly: boolean } => Boolean(item)
      );
  }, [processes]);

  const processSequenceByValue = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of processes ?? []) {
      const rawId = (p as any)?.id ?? (p as any)?.ID;
      const idStr = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
      if (!idStr) continue;
      const seq = Number((p as any)?.sequence ?? (p as any)?.Sequence);
      map.set(idStr, Number.isFinite(seq) ? seq : Number.MAX_SAFE_INTEGER);
    }
    return map;
  }, [processes]);

  const machineOptions = useMemo<Array<{ value: string | number; label: string }>>(() => {
    return (machines ?? [])
      .map((machine: any) => {
        const rawId = machine?.id ?? machine?.ID;
        const idStr = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
        if (!idStr) return null;
        const asNumber = Number(idStr);
        const value: string | number = Number.isFinite(asNumber) ? asNumber : idStr;
        const name = typeof machine?.machine_name === "string" ? machine.machine_name.trim() : "";
        const number = typeof machine?.machine_number === "string" ? machine.machine_number.trim() : "";
        return {
          value,
          label: number && name ? `${number} — ${name}` : name || number || idStr,
        };
      })
      .filter((item): item is { value: string | number; label: string } => Boolean(item));
  }, [machines]);

  const uomIsForbidden = useMemo(() => {
    const err = uomsError as any;
    const status = err?.status ?? err?.data?.status;
    return Number(status) === 403;
  }, [uomsError]);

  const seededUomOptions = useMemo<Array<{ value: string; label: string; code: string }>>(
    () => [
      { value: "PCS", label: "PCS — Pieces", code: "PCS" },
      { value: "KG", label: "KG — Kilogram", code: "KG" },
      { value: "M", label: "M — Meter", code: "M" },
      { value: "MM", label: "MM — Millimeter", code: "MM" },
    ],
    []
  );

  const uomOptions = useMemo<Array<{ value: string; label: string; code: string }>>(() => {
    if (!apiEnabled) return seededUomOptions;
    const mapped = (uoms ?? [])
      .map((uom) => {
        const idValue = String((uom as any).id ?? "").trim();
        const code = String((uom as any).code ?? (uom as any).unit_code ?? "").trim().toUpperCase();
        const name = String((uom as any).name ?? (uom as any).unit_name ?? "").trim();
        if (!idValue || !code) return null;
        return { value: idValue, label: code && name ? `${code} — ${name}` : code, code };
      })
      .filter((item): item is { value: string; label: string; code: string } => Boolean(item));
    if (mapped.length > 0) return mapped;
    return uomIsForbidden ? [] : seededUomOptions;
  }, [apiEnabled, seededUomOptions, uomIsForbidden, uoms]);

  const uomCodeByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of uomOptions) {
      map.set(String(option.value), option.code);
    }
    return map;
  }, [uomOptions]);

  const uomValueByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of uomOptions) {
      map.set(option.code, String(option.value));
    }
    return map;
  }, [uomOptions]);

  const isAssemblyProcessValue = (value: unknown) => {
    const key = String(value ?? "").trim();
    if (!key) return false;
    return processOptions.some(
      (option) => String(option.value).trim() === key && option.isAssembly === true
    );
  };

  const isParentAssembly = useMemo(() => {
    if (!Array.isArray(watchedParentProcessRoutes) || watchedParentProcessRoutes.length === 0) {
      return false;
    }
    return watchedParentProcessRoutes.some((route) => isAssemblyProcessValue(route?.process_id));
  }, [watchedParentProcessRoutes, processOptions]);

  useEffect(() => {
    if (!bom) return;
    const mapRouteFromApi = (route: any): ProcessRouteForm => ({
      op_seq: typeof route?.op_seq === "number" ? route.op_seq : undefined,
      process_id: route?.process_id ?? undefined,
      machine_id: route?.machine_id != null ? Number(route.machine_id) || null : null,
      cycle_time_sec: typeof route?.cycle_time_sec === "number" ? route.cycle_time_sec : undefined,
      setup_time_min: typeof route?.setup_time_min === "number" ? route.setup_time_min : undefined,
      machine_stroke: typeof route?.machine_stroke === "string" ? route.machine_stroke : undefined,
      tooling_ref: typeof route?.tooling_ref === "string" ? route.tooling_ref : undefined,
      tooling_type: Array.isArray(route?.toolings)
        ? typeof route.toolings[0]?.tooling_type === "string"
          ? route.toolings[0].tooling_type
          : undefined
        : undefined,
    });

    const mapMaterialSpecFromApi = (spec: any): MaterialSpecForm | undefined => {
      if (!spec || typeof spec !== "object") return undefined;
      return {
        material_code:
          typeof spec.material_code === "string"
            ? spec.material_code
            : typeof spec.material_grade === "string"
              ? spec.material_grade
              : typeof spec.grade === "string"
                ? spec.grade
                : undefined,
        form: typeof spec.form === "string" ? spec.form : undefined,
        type_material:
          typeof spec.type_material === "string"
            ? spec.type_material
            : typeof spec.raw_material_type === "string"
              ? spec.raw_material_type
              : undefined,
        grade:
          typeof spec.grade === "string"
            ? spec.grade
            : typeof spec.material_grade === "string"
              ? spec.material_grade
              : undefined,
        weight_kg: typeof spec.weight_kg === "number" ? spec.weight_kg : undefined,
        width_mm: typeof spec.width_mm === "number" ? spec.width_mm : undefined,
        diameter_mm: typeof spec.diameter_mm === "number" ? spec.diameter_mm : undefined,
        thickness_mm: typeof spec.thickness_mm === "number" ? spec.thickness_mm : undefined,
        length_mm: typeof spec.length_mm === "number" ? spec.length_mm : undefined,
        cycle_time_sec: typeof spec.cycle_time_sec === "number" ? spec.cycle_time_sec : undefined,
        setup_time_min: typeof spec.setup_time_min === "number" ? spec.setup_time_min : undefined,
        customer_cycle: typeof spec.customer_cycle === "string" ? spec.customer_cycle : undefined,
      };
    };

    const mapUomToFormValue = (rawUom: unknown) => {
      const code = typeof rawUom === "string" ? rawUom.trim().toUpperCase() : "";
      if (!code) return undefined;
      return uomValueByCode.get(code) ?? code;
    };

    const mapChildFromApi = (child: any): ChildPartForm => ({
      child_id: child?.child_id ?? null,
      line_id: child?.line_id ?? null,
      uniq_code: typeof child?.uniq_code === "string" ? child.uniq_code : undefined,
      parent_uniq_code:
        typeof child?.parent_uniq_code === "string" ? child.parent_uniq_code : undefined,
      level: typeof child?.level === "number" ? child.level : undefined,
      qty_per_uniq:
        typeof child?.qty_per_uniq === "number"
          ? child.qty_per_uniq
          : typeof child?.qpu === "number"
            ? child.qpu
            : 1,
      scrap_factor: typeof child?.scrap_factor === "number" ? child.scrap_factor : 0,
      is_phantom: Boolean(child?.is_phantom),
      part_name: typeof child?.part_name === "string" ? child.part_name : undefined,
      part_number: typeof child?.part_number === "string" ? child.part_number : undefined,
      model: typeof child?.model === "string" ? child.model : undefined,
      uom: mapUomToFormValue(child?.uom),
      asset_id: child?.asset?.id ?? null,
      asset_url: typeof child?.asset?.url === "string" ? child.asset.url : null,
      material_spec: mapMaterialSpecFromApi(child?.material_spec),
      process_routes: Array.isArray(child?.process_routes) ? child.process_routes.map(mapRouteFromApi) : [],
      children: Array.isArray(child?.children) ? child.children.map(mapChildFromApi) : [],
    });

    form.setFieldsValue({
      change_note: "",
      parent_uniq: typeof (bom as any)?.uniq_code === "string" ? (bom as any).uniq_code : undefined,
      part_name: typeof (bom as any)?.part_name === "string" ? (bom as any).part_name : undefined,
      part_number: typeof (bom as any)?.part_number === "string" ? (bom as any).part_number : undefined,
      model: typeof (bom as any)?.model === "string" ? (bom as any).model : undefined,
      uom: mapUomToFormValue((bom as any)?.uom),
      status: typeof (bom as any)?.status === "string" ? (bom as any).status : "Draft",
      description: typeof (bom as any)?.description === "string" ? (bom as any).description : undefined,
      asset_id: (bom as any)?.asset?.id ?? null,
      asset_url: typeof (bom as any)?.asset?.url === "string" ? (bom as any).asset.url : null,
      material_spec: mapMaterialSpecFromApi((bom as any)?.material_spec),
      process_routes: Array.isArray((bom as any)?.process_routes)
        ? (bom as any).process_routes.map(mapRouteFromApi)
        : [],
      child_parts: Array.isArray((bom as any)?.children)
        ? (bom as any).children.map(mapChildFromApi)
        : [],
    });
    setSelectedNodeKey("parent");
    setFileList([]);
    setChildFileLists({});
  }, [bom, form, uomValueByCode]);

  const treeItems = useMemo(() => {
    return buildBomTreeItems(valuesSnapshot ?? {});
  }, [valuesSnapshot]);

  const selectedChildPath = useMemo(() => {
    return selectedNodeKey === "parent" ? undefined : keyToChildPath(selectedNodeKey);
  }, [selectedNodeKey]);

  const selectedChild = useMemo(() => {
    return selectedNodeKey === "parent" ? undefined : getChildAtPath(valuesSnapshot ?? {}, selectedNodeKey);
  }, [selectedNodeKey, valuesSnapshot]);

  const selectedChildFileKey = useMemo(() => {
    return selectedChildPath ? toChildFileKey(selectedChildPath) : "";
  }, [selectedChildPath]);

  const addLevel1Child = () => {
    const current = form.getFieldValue(["child_parts"]) ?? [];
    if (current.length >= MAX_CHILDREN_PER_PARENT) {
      messageApi.warning(`Maximum ${MAX_CHILDREN_PER_PARENT} child parts allowed for each parent.`);
      return;
    }
    form.setFieldValue(["child_parts"], [...current, createDefaultChild()]);
  };

  const addChildAtKey = (key: BomSelectedNodePath) => {
    const dynamicForm = form as any;
    const path = key === "parent" ? ["child_parts"] : [...keyToChildPath(key), "children"];
    const current = dynamicForm.getFieldValue(path) ?? [];
    if (current.length >= MAX_CHILDREN_PER_PARENT) {
      messageApi.warning(`Maximum ${MAX_CHILDREN_PER_PARENT} child parts allowed for each parent.`);
      return;
    }
    dynamicForm.setFieldValue(path, [...current, createDefaultChild()]);
  };

  const removeNodeAtKey = (key: BomSelectedNodePath) => {
    if (key === "parent") return;
    const dynamicForm = form as any;
    const path = keyToChildPath(key);
    const listPath = path.slice(0, -1);
    const index = path[path.length - 1];
    if (typeof index !== "number") return;
    const current = dynamicForm.getFieldValue(listPath) ?? [];
    dynamicForm.setFieldValue(
      listPath,
      current.filter((_: unknown, idx: number) => idx !== index)
    );
    setSelectedNodeKey("parent");
  };

  const onSave = async () => {
    try {
      if (!isLatest) {
        messageApi.error("Tidak bisa edit historical version. Pilih latest version dulu, lalu edit.");
        return;
      }

      const values = form.getFieldsValue(true) as EditValues;
      const assemblyMode =
        Array.isArray(values.process_routes) &&
        values.process_routes.some((route) => isAssemblyProcessValue(route?.process_id));

      // Parent required fields are validated from the full form store — not via
      // form.validateFields — because only one node editor is mounted at a time,
      // so the parent Form.Items may be unmounted when Save is clicked. Relying on
      // validateFields there fails silently and the Save button looks dead.
      const missingParent: string[] = [];
      if (!cleanText(values.change_note)) missingParent.push("Change Note");
      if (!cleanText(values.part_name)) missingParent.push("Part Name");
      if (!cleanText(values.part_number)) missingParent.push("Part Number");
      if (!cleanText(values.status)) missingParent.push("Status");
      if (missingParent.length > 0) {
        setSelectedNodeKey("parent");
        messageApi.error(`Lengkapi field wajib parent: ${missingParent.join(", ")}.`);
        return;
      }

      if (!assemblyMode) {
        const spec = values.material_spec;
        const specMissing =
          !cleanText(spec?.material_code) && !cleanText(spec?.grade)
            ? "Material Code/Grade"
            : !cleanText(spec?.form)
              ? "Form"
              : "";
        if (specMissing) {
          setSelectedNodeKey("parent");
          messageApi.error(`Material specification wajib: ${specMissing}.`);
          return;
        }
      }

      const rootUniqValue = cleanText(values.parent_uniq);
      if (!rootUniqValue) {
        messageApi.error("Missing parent UNIQ");
        return;
      }

      const resolveUomCode = (rawValue: unknown): string | null => {
        if (rawValue === undefined || rawValue === null) return null;
        const key = String(rawValue).trim();
        if (!key) return null;
        return uomCodeByValue.get(key) ?? key.toUpperCase();
      };

      const mapMaterialSpec = (spec?: MaterialSpecForm) => {
        const normalizedForm = normalizeMaterialForm(spec?.form);
        const payload: Record<string, unknown> = {
          grade: cleanText(spec?.grade) ?? cleanText(spec?.material_code) ?? null,
          material_grade: cleanText(spec?.grade) ?? cleanText(spec?.material_code) ?? null,
          type_material: cleanText(spec?.type_material) ?? null,
          form: normalizedForm ?? null,
          width_mm:
            typeof spec?.width_mm === "number" && Number.isFinite(spec.width_mm) ? spec.width_mm : null,
          diameter_mm:
            typeof spec?.diameter_mm === "number" && Number.isFinite(spec.diameter_mm)
              ? spec.diameter_mm
              : null,
          thickness_mm:
            typeof spec?.thickness_mm === "number" && Number.isFinite(spec.thickness_mm)
              ? spec.thickness_mm
              : null,
          length_mm:
            typeof spec?.length_mm === "number" && Number.isFinite(spec.length_mm) ? spec.length_mm : null,
          weight_kg:
            typeof spec?.weight_kg === "number" && Number.isFinite(spec.weight_kg) ? spec.weight_kg : null,
          cycle_time_sec:
            typeof spec?.cycle_time_sec === "number" && Number.isFinite(spec.cycle_time_sec)
              ? spec.cycle_time_sec
              : null,
          setup_time_min:
            typeof spec?.setup_time_min === "number" && Number.isFinite(spec.setup_time_min)
              ? spec.setup_time_min
              : null,
          customer_cycle: cleanText(spec?.customer_cycle) ?? null,
        };
        const hasMeaningfulValue = Object.values(payload).some(
          (value) => value !== null && value !== undefined && value !== ""
        );
        return hasMeaningfulValue ? payload : null;
      };

      const mapProcessRoutes = (routes?: ProcessRouteForm[]) => {
        const mapped = (routes ?? [])
          .map((route, index) => {
            const processId = toNumberId(route.process_id);
            if (processId === undefined) return null;
            const body: Record<string, unknown> = {
              op_seq:
                typeof route.op_seq === "number" && Number.isFinite(route.op_seq)
                  ? route.op_seq
                  : (index + 1) * 10,
              process_id: processId,
              machine_id:
                route.machine_id != null && Number.isFinite(route.machine_id)
                  ? route.machine_id
                  : null,
            };
            if (typeof route.cycle_time_sec === "number" && Number.isFinite(route.cycle_time_sec)) {
              body.cycle_time_sec = route.cycle_time_sec;
            }
            if (typeof route.setup_time_min === "number" && Number.isFinite(route.setup_time_min)) {
              body.setup_time_min = route.setup_time_min;
            }
            if (cleanText(route.machine_stroke)) body.machine_stroke = cleanText(route.machine_stroke);
            if (cleanText(route.tooling_ref)) body.tooling_ref = cleanText(route.tooling_ref);
            body.toolings = cleanText(route.tooling_type)
              ? [{ tooling_type: cleanText(route.tooling_type) }]
              : [];
            return body;
          })
          .filter((item): item is Record<string, unknown> => Boolean(item));

        return mapped
          .map((body, index) => ({
            body,
            index,
            seq: processSequenceByValue.get(String(body.process_id)) ?? Number.MAX_SAFE_INTEGER,
          }))
          .sort((a, b) => a.seq - b.seq || a.index - b.index)
          .map((entry, i) => ({ ...entry.body, op_seq: (i + 1) * 10 }));
      };

      const files: Array<{ key: string; file: File }> = [];
      const seenUniqs = new Set<string>();

      const mapChildParts = (
        children: ChildPartForm[] | undefined,
        level: number,
        parentUniq: string,
        basePath: Array<string | number>
      ): any[] => {
        const list = Array.isArray(children) ? children : [];
        return list.map((child, index) => {
          const currentPath = [...basePath, index];
          const uniqCode = cleanText(child.uniq_code);
          const partName = cleanText(child.part_name);
          const partNumber = cleanText(child.part_number);
          const childUom = resolveUomCode(child.uom);
          const pathLabel = currentPath
            .filter((segment) => typeof segment === "number")
            .map((value) => Number(value) + 1)
            .join(".");
          if (!uniqCode || !partName || !partNumber || !childUom) {
            throw new Error(`Child #${pathLabel || index + 1} belum lengkap.`);
          }
          if (seenUniqs.has(uniqCode)) throw new Error(`Duplicate child UNIQ '${uniqCode}'.`);
          seenUniqs.add(uniqCode);

          const childFileKey = toChildFileKey(currentPath);
          const childFile = asFile(childFileLists?.[childFileKey]?.[0]?.originFileObj);
          const childUploadKey = childFile
            ? childFile.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_").toLowerCase()
            : null;
          if (childFile && childUploadKey) files.push({ key: `upload_${childUploadKey}`, file: childFile });

          return {
            uniq_code: uniqCode,
            parent_uniq_code: parentUniq,
            level,
            qty_per_uniq:
              typeof child.qty_per_uniq === "number" && Number.isFinite(child.qty_per_uniq)
                ? child.qty_per_uniq
                : 1,
            scrap_factor:
              typeof child.scrap_factor === "number" && Number.isFinite(child.scrap_factor)
                ? child.scrap_factor
                : 0,
            is_phantom: child.is_phantom === true,
            part_name: partName,
            part_number: partNumber,
            model: cleanNullableText(child.model),
            uom: childUom,
            asset_id: childFile ? null : child.asset_id ?? null,
            upload_key: childUploadKey ?? null,
            material_spec: mapMaterialSpec(child.material_spec),
            process_routes: mapProcessRoutes(child.process_routes),
            children: mapChildParts(child.children, level + 1, uniqCode, [...currentPath, "children"]),
            raw_material_type: cleanText(child.category) ?? undefined,
          };
        });
      };

      const parentUom = resolveUomCode(values.uom);
      if (!parentUom) {
        messageApi.error("UOM is required.");
        return;
      }

      const parentFile = asFile(fileList?.[0]?.originFileObj);
      if (parentFile) files.push({ key: "upload_parent", file: parentFile });

      const parentRoutes = mapProcessRoutes(values.process_routes);
      const parentMaterialSpec = assemblyMode ? null : mapMaterialSpec(values.material_spec);
      const childrenPayload = mapChildParts(values.child_parts, 1, rootUniqValue, ["child_parts"]);

      if (assemblyMode && childrenPayload.length < 2) {
        messageApi.error("Assembly parent must have at least 2 child parts.");
        return;
      }
      if (!assemblyMode && !parentMaterialSpec) {
        messageApi.error("Material specifications are required.");
        return;
      }

      const replaceResult = await replaceBom({
        bom_id: resolvedBomId,
        payload: {
          change_note: cleanText(values.change_note),
          part_name: cleanText(values.part_name),
          part_number: cleanText(values.part_number),
          model: cleanNullableText(values.model),
          uom: parentUom,
          status: cleanText(values.status) ?? "Draft",
          description: cleanNullableText(values.description),
          asset_id: parentFile ? null : values.asset_id ?? null,
          upload_key: parentFile ? "parent" : null,
          material_spec: parentMaterialSpec,
          process_routes: parentRoutes,
          children: childrenPayload,
        },
        files,
      }).unwrap();

      const newBomId =
        (replaceResult as any)?.data?.new_bom_id ??
        (replaceResult as any)?.data?.bom_id ??
        (replaceResult as any)?.new_bom_id ??
        resolvedBomId;

      messageApi.success("BOM updated");
      router.push(`/bill-of-material/${encodeURIComponent(String(newBomId))}`);
    } catch (err) {
      const anyErr = err as any;
      const data = anyErr?.data;
      const pickMessage = (value: unknown): string => {
        if (!value || typeof value !== "object") return "";
        const obj = value as Record<string, unknown>;
        if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
        if (typeof obj.error === "string" && obj.error.trim()) return obj.error.trim();
        const nested = pickMessage(obj.data);
        if (nested) return nested;
        return "";
      };
      const detail =
        typeof data === "string"
          ? data
          : pickMessage(data) ||
            (data && typeof data === "object" ? JSON.stringify(data) : "") ||
            (anyErr?.message ? String(anyErr.message) : "");
      if (detail) messageApi.error(detail);
    }
  };

  return (
    <div className="bom-edit-page px-4 pb-8 pt-4 md:px-6">
      {contextHolder}

      <BomEditHeader
        titlePartName={titlePartName}
        resolvedBomId={resolvedBomId}
        status={currentStatus}
        isLatest={isLatest}
        isSaving={replaceState.isLoading}
        disabled={!isLatest}
        onBack={() => router.push(`/bill-of-material/${encodeURIComponent(resolvedBomId)}`)}
        onSave={onSave}
      />

      <Card className="rounded-3xl border-slate-200 shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : error ? (
          <Text type="danger">Failed to load BOM full detail.</Text>
        ) : (
          <>
            {!isLatest && currentBomId ? (
              <Alert
                type="warning"
                showIcon
                className="mb-6"
                message="Historical version (read-only)"
                description={
                  <div>
                    Edit hanya boleh di latest version.
                    <div className="mt-2">
                      <a
                        className="text-sm font-medium text-sky-600"
                        href={`/bill-of-material/${encodeURIComponent(currentBomId)}/edit`}
                      >
                        Go to latest version
                      </a>
                    </div>
                  </div>
                }
              />
            ) : null}

            <Form layout="vertical" form={form} disabled={!isLatest} requiredMark={false}>
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <BomStructurePanel
                  activeKey={selectedNodeKey}
                  items={treeItems}
                  rootLabel={titlePartName || "Parent BOM"}
                  rootUniq={rootUniq || "—"}
                  rootQtyLabel=""
                  disabled={!isLatest}
                  onSelect={setSelectedNodeKey}
                  onAddLevel1Child={addLevel1Child}
                  onAddChild={addChildAtKey}
                  onRemove={removeNodeAtKey}
                />

                <div className="min-w-0">
                  <BomDetailPanel
                    selectedNodeKey={selectedNodeKey}
                    selectedChildPath={selectedChildPath}
                    selectedChildLabel={
                      selectedChild?.part_name ||
                      selectedChild?.part_number ||
                      selectedChild?.uniq_code ||
                      "Child node"
                    }
                    selectedChildLevelLabel={`L${selectedChild?.level ?? 1}`}
                    form={form}
                    disabled={!isLatest}
                    isParentAssembly={isParentAssembly}
                    existingParentAssetUrl={existingParentAssetUrl}
                    parentFileList={fileList}
                    setParentFileList={setFileList}
                    selectedChildAssetUrl={selectedChild?.asset_url ? resolveAssetUrl(selectedChild.asset_url) : ""}
                    selectedChildFileList={childFileLists[selectedChildFileKey] ?? []}
                    setSelectedChildFileList={(files) =>
                      setChildFileLists((prev) => ({ ...prev, [selectedChildFileKey]: files }))
                    }
                    processOptions={processOptions}
                    machineOptions={machineOptions}
                    isProcessesLoading={isProcessesLoading}
                    isMachinesLoading={isMachinesLoading}
                    isUomsLoading={apiEnabled && isUomsLoading && !uomIsForbidden}
                    uomOptions={uomOptions}
                  />
                </div>
              </div>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}
