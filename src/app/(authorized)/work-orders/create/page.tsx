"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs, { type Dayjs } from "dayjs";
import { apiBaseUrl, generateHeaders } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery, useGetBomListQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useGetProcessesQuery } from "@/lib/api/system-settings/api";
import { useGetMachinesQuery } from "@/lib/api/machines/api";
import {
  useCreateWorkOrderMutation,
  useGetWorkOrderUniqOptionsQuery,
} from "@/lib/api/work-orders/api";
import { useLazyGetInventoryKanbanSummaryQuery } from "@/lib/api/inventory/api";
import { useGetFinishedGoodParameterizedSummaryQuery } from "@/lib/api/finished-goods/api";

type WorkOrderType = "New" | "Additional" | "Rework" | "Assembly";

type UniqOption = {
  uniq: string;
  partName: string;
  partNumber?: string;
  model?: string;
  uom: string;
  processes: string[];
};

type UniqLine = {
  id: string;
  parentId?: string; // ID of parent line (for child rows)
  uniq?: string;
  partName?: string;
  partNumber?: string;
  model?: string;
  qty?: number;
  uom?: string;
  process?: string;
  processes?: string[]; // All processes from BOM (used for child rows)
  kanbanNumber: string;
  targetStock?: number | null;
  stockQty?: number | null;
  qpu?: number | null; // Qty Per Uniq dari BOM
  level?: number;
};

const nextWoNumber = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seed = `${yyyy}${mm}${dd}`;
  const random = Math.floor(Math.random() * 900 + 100);
  return `WO-${seed}-${random}`;
};

const nextKanbanNumber = (index: number) =>
  `KBN-AUTO-${String(index + 1).padStart(3, "0")}`;

export default function CreateWorkOrderPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { TextArea } = Input;
  const apiEnabled = Boolean(apiBaseUrl);
  const [createWorkOrder, createWorkOrderState] = useCreateWorkOrderMutation();

  const uniqOptionsQuery = useGetWorkOrderUniqOptionsQuery(
    { limit: 200, sources: ["raw_material", "indirect", "subcon"] },
    { skip: !apiEnabled },
  );

  const [woNumber] = useState(() => nextWoNumber());
  const [lines, setLines] = useState<UniqLine[]>([
    { id: "l-1", kanbanNumber: nextKanbanNumber(0) },
  ]);
  const { data: bomTreeRes } = useGetBomListQuery(
    { page: 1, limit: 1000 },
    {
      skip: !apiEnabled,
    },
  );
  const { data: processRecords = [] } = useGetProcessesQuery(undefined, {
    skip: !apiEnabled,
  });
  const [getInventoryKanbanSummary] = useLazyGetInventoryKanbanSummaryQuery();
  const [requestedFinished, setRequestedFinished] = useState<{
    id: string;
    uniq: string;
  } | null>(null);
  const finishedQuery = useGetFinishedGoodParameterizedSummaryQuery(
    requestedFinished ? { uniq_code: requestedFinished.uniq } : (null as any),
    { skip: !apiEnabled || !requestedFinished },
  );

  const fallbackUniqOptions: UniqOption[] = [
    {
      uniq: "LV7-001",
      partName: "Engine Mount Assembly",
      uom: "pcs",
      processes: ["Cutting", "Welding", "QC"],
    },
    {
      uniq: "LV7-002",
      partName: "Engine Mount Base",
      uom: "pcs",
      processes: ["Milling", "QC"],
    },
    {
      uniq: "LV8-003",
      partName: "Suspension Arm",
      uom: "pcs",
      processes: ["Forging", "Machining", "QC"],
    },
  ];

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data],
  );

  const bomProcessMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    const nodes: any[] = (() => {
      const anyRes = bomTreeRes as any;
      if (!anyRes) return [];
      if (Array.isArray(anyRes.data)) return anyRes.data;
      if (Array.isArray(anyRes.data?.items)) return anyRes.data.items;
      if (Array.isArray(anyRes.items)) return anyRes.items;
      return [];
    })();
    const extract = (n: any) => {
      const uniq = String(n?.uniq ?? n?.uniq_code ?? n?.uniqCode ?? "").trim();
      if (!uniq) return;
      const routes = Array.isArray(n?.process_routes)
        ? n.process_routes
        : Array.isArray(n?.processRoutes)
          ? n.processRoutes
          : [];
      const names: string[] = [];
      for (const r of routes) {
        const name = (r?.process_name ?? r?.processName ?? null) as
          string | null;
        if (name && String(name).trim()) names.push(String(name).trim());
        else if (r?.process_id) {
          const pid = String(r.process_id);
          const found = processRecords.find(
            (p: any) => String(p.id) === pid || String(p.process_code) === pid,
          );
          if (found && found.process_name) names.push(found.process_name);
        }
      }
      if (names.length) map[uniq] = Array.from(new Set(names));
    };
    for (const n of nodes) {
      extract(n);
      if (Array.isArray(n?.children)) {
        for (const c of n.children) extract(c);
      }
    }
    return map;
  }, [bomTreeRes?.data, processRecords]);

  // [wo-estimated-time] Master mesin -> machine_capacity (per mesin).
  const { data: machineRecords = [] } = useGetMachinesQuery(undefined, {
    skip: !apiEnabled,
  });

  // Index kapasitas mesin dari halaman Machine Master Data (machine_capacity).
  // Di-index by id, machine_number, dan machine_name supaya route BOM tetap
  // ke-mapping walaupun yang tersimpan bukan id mesin.
  const machineCapacityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of (machineRecords ?? []) as any[]) {
      const cap = Number(m?.machine_capacity ?? 0);
      if (!Number.isFinite(cap) || cap <= 0) continue;
      for (const key of [m?.id, m?.machine_number, m?.machine_name]) {
        const k = String(key ?? "")
          .trim()
          .toLowerCase();
        if (k) map[k] = cap;
      }
    }
    return map;
  }, [machineRecords]);

  // [wo-estimated-time] Cycle time (menit/pcs) + machine capacity per uniq, diambil dari BOM.
  // cycle_time_sec disimpan dalam detik di BOM, di sini dikonversi ke menit.
  const bomTimeMap = useMemo(() => {
    const map: Record<string, { cycleMin: number; machineCapacity: number }> =
      {};
    const nodes: any[] = (() => {
      const anyRes = bomTreeRes as any;
      if (!anyRes) return [];
      if (Array.isArray(anyRes.data)) return anyRes.data;
      if (Array.isArray(anyRes.data?.items)) return anyRes.data.items;
      if (Array.isArray(anyRes.items)) return anyRes.items;
      return [];
    })();

    const pickNumber = (...values: unknown[]) => {
      for (const v of values) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return 0;
    };

    const extract = (n: any) => {
      const uniq = String(n?.uniq ?? n?.uniq_code ?? n?.uniqCode ?? "").trim();
      if (!uniq) return;
      const spec =
        n?.material_spec ?? n?.materialSpec ?? n?.material_specifications ?? {};
      const routes = Array.isArray(n?.process_routes)
        ? n.process_routes
        : Array.isArray(n?.processRoutes)
          ? n.processRoutes
          : [];
      const cycleSec = pickNumber(
        spec?.cycle_time_sec,
        spec?.cycle_time_sec_per_pc,
        n?.cycle_time_sec,
        routes[0]?.cycle_time_sec,
      );
      if (cycleSec <= 0) return;
      // Mesin yang dipakai uniq ini diambil dari process route BOM,
      // kapasitasnya dicari di master mesin (Machine Master Data).
      const machineKeys = [
        routes[0]?.machine_id,
        routes[0]?.machineId,
        routes[0]?.machine_number,
        routes[0]?.machine_name,
        routes[0]?.machineName,
      ]
        .map((v) =>
          String(v ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean);
      let capacity = 0;
      for (const key of machineKeys) {
        const found = machineCapacityById[key];
        if (found && found > 0) {
          capacity = found;
          break;
        }
      }
      map[uniq] = {
        cycleMin: Math.round((cycleSec / 60) * 10000) / 10000,
        machineCapacity: capacity > 0 ? capacity : 1,
      };
    };

    for (const n of nodes) {
      extract(n);
      if (Array.isArray(n?.children)) for (const c of n.children) extract(c);
    }
    return map;
  }, [bomTreeRes, machineCapacityById]);

  const processNameOptions = useMemo(() => {
    const names = processRecords
      .map((item) => item.process_name)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(names));
  }, [processRecords]);

  const uniqOptions = useMemo<UniqOption[]>(() => {
    if (apiEnabled && uniqOptionsQuery.data?.length) {
      return uniqOptionsQuery.data.map((o) => {
        const code = o.uniq_code;
        return {
          uniq: code,
          partName: o.part_name ?? bomIndex.partNameByUniq[code] ?? "",
          partNumber: o.part_number ?? bomIndex.partNumberByUniq[code] ?? "",
          model: o.model ?? bomIndex.assemblyCodeByUniq[code] ?? "",
          uom: o.uom ?? "pcs",
          processes: bomProcessMap[code] ?? processNameOptions,
        };
      });
    }

    if (!bomIndex.options.length) return fallbackUniqOptions;
    return bomIndex.options.map((option) => ({
      uniq: option.value,
      partName: bomIndex.partNameByUniq[option.value] ?? "",
      partNumber: bomIndex.partNumberByUniq[option.value] ?? "",
      model: bomIndex.assemblyCodeByUniq[option.value] ?? "",
      uom: "pcs",
      processes: bomProcessMap[option.value] ?? processNameOptions,
    }));
  }, [apiEnabled, bomIndex, processNameOptions, uniqOptionsQuery.data]);

  const uniqSelectOptions = useMemo(() => {
    const bomData = bomTreeRes?.data;
    const topNodes: any[] = Array.isArray(bomData)
      ? bomData
      : Array.isArray((bomData as any)?.items)
        ? (bomData as any).items
        : Array.isArray((bomData as any)?.rows)
          ? (bomData as any).rows
          : [];
    const fromBom = topNodes
      .map((n) => {
        const code = String(
          n?.uniq ?? n?.uniq_code ?? n?.uniqCode ?? "",
        ).trim();
        return code ? { label: code, value: code } : null;
      })
      .filter(Boolean) as { label: string; value: string }[];
    const fromApi = uniqOptions.map((u) => ({ label: u.uniq, value: u.uniq }));
    const map = new Map<string, { label: string; value: string }>();
    for (const it of [...fromBom, ...fromApi]) {
      if (!map.has(it.value)) map.set(it.value, it);
    }
    return Array.from(map.values());
  }, [uniqOptions, bomIndex]);

  useEffect(() => {
    form.setFieldsValue({ woNumber });
  }, [form, woNumber]);

  const addLine = () => {
    setLines((prev) => {
      const next = [
        ...prev,
        { id: `l-${Date.now()}`, kanbanNumber: nextKanbanNumber(prev.length) },
      ];
      return next.map((l, idx) => ({
        ...l,
        kanbanNumber: nextKanbanNumber(idx),
      }));
    });
  };

  // FIX #3: Hapus parent sekaligus semua child-nya
  const removeLine = (id: string) => {
    setLines((prev) => {
      // Kumpulkan ID yang harus dihapus: parent + semua child-nya
      const toRemove = new Set<string>();
      toRemove.add(id);
      prev.forEach((l) => {
        if (l.parentId === id) toRemove.add(l.id);
      });
      const next = prev.filter((l) => !toRemove.has(l.id));
      const ensured = next.length
        ? next
        : [{ id: `l-${Date.now()}`, kanbanNumber: nextKanbanNumber(0) }];
      return ensured.map((l, idx) => ({
        ...l,
        kanbanNumber: nextKanbanNumber(idx),
      }));
    });
  };

  const updateLine = (id: string, patch: Partial<UniqLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const onSelectUniq = (id: string, uniq: string) => {
    const getFirstProcessName = (node: any): string | null => {
      if (!node) return null;
      const routes = Array.isArray(node.process_routes)
        ? node.process_routes
        : Array.isArray(node.processRoutes)
          ? node.processRoutes
          : Array.isArray(node.processes)
            ? node.processes
            : [];
      if (routes.length) {
        const name =
          routes[0]?.process_name ??
          routes[0]?.processName ??
          routes[0]?.name ??
          null;
        if (name && String(name).trim()) return String(name).trim();
        const pid =
          routes[0]?.process_id ??
          routes[0]?.processId ??
          routes[0]?.process ??
          null;
        if (pid) {
          const pidStr = String(pid);
          const foundProc = processRecords.find(
            (p) => String(p.id) === pidStr || String(p.process_code) === pidStr,
          );
          if (foundProc) return foundProc.process_name ?? null;
        }
      }
      return null;
    };

    // Ambil semua process names dari BOM node (untuk child: multiple processes)
    const getAllProcessNames = (node: any): string[] => {
      if (!node) return [];
      const routes = Array.isArray(node.process_routes)
        ? node.process_routes
        : Array.isArray(node.processRoutes)
          ? node.processRoutes
          : Array.isArray(node.processes)
            ? node.processes
            : [];
      const names: string[] = [];
      for (const r of routes) {
        const name = r?.process_name ?? r?.processName ?? r?.name ?? null;
        if (name && String(name).trim()) {
          names.push(String(name).trim());
        } else {
          const pid = r?.process_id ?? r?.processId ?? r?.process ?? null;
          if (pid) {
            const pidStr = String(pid);
            const foundProc = processRecords.find(
              (p) =>
                String(p.id) === pidStr || String(p.process_code) === pidStr,
            );
            if (foundProc?.process_name) names.push(foundProc.process_name);
          }
        }
      }
      return Array.from(new Set(names));
    };

    const found = uniqOptions.find((u) => u.uniq === uniq);
    // Auto-fill parent process(es) from BOM routes (real routes only, not the
    // full process catalog fallback) as a baseline; refined below if the BOM
    // node is found.
    const baselineProcesses = Array.isArray(bomProcessMap[uniq])
      ? bomProcessMap[uniq]
      : [];
    updateLine(id, {
      uniq,
      partName: found?.partName,
      partNumber: found?.partNumber,
      model: found?.model,
      uom: found?.uom ?? bomIndex.uomByUniq[uniq] ?? "pcs",
      process: baselineProcesses[0],
      processes: baselineProcesses,
    });

    const findNode = (nodes: any[] | undefined): any | null => {
      if (!Array.isArray(nodes)) return null;
      for (const n of nodes) {
        const nodeUniq = String(
          n?.uniq ?? n?.uniq_code ?? n?.uniqCode ?? "",
        ).trim();
        if (nodeUniq && nodeUniq === String(uniq).trim()) return n;
        if (Array.isArray(n?.children)) {
          const child = findNode(n.children as any[]);
          if (child) return child;
        }
      }
      return null;
    };

    const bomData = bomTreeRes?.data;
    const bomArray = Array.isArray(bomData)
      ? bomData
      : Array.isArray((bomData as any)?.items)
        ? (bomData as any).items
        : [];
    const bomNode = findNode(bomArray);

    if (bomNode) {
      try {
        console.debug("Found BOM node for uniq", uniq, bomNode);
      } catch (e) {
        /* ignore */
      }

      const nodeProcessRoutes = Array.isArray(bomNode.process_routes)
        ? bomNode.process_routes
        : Array.isArray(bomNode.processRoutes)
          ? bomNode.processRoutes
          : [];
      let firstProcessName: string | null = null;
      if (nodeProcessRoutes.length) {
        firstProcessName = (nodeProcessRoutes[0]?.process_name ??
          nodeProcessRoutes[0]?.processName ??
          null) as string | null;
        if (!firstProcessName) {
          const pid =
            nodeProcessRoutes[0]?.process_id ??
            nodeProcessRoutes[0]?.processId ??
            nodeProcessRoutes[0]?.process ??
            null;
          if (pid) {
            const pidStr = String(pid);
            const foundProc = processRecords.find(
              (p) =>
                String(p.id) === pidStr || String(p.process_code) === pidStr,
            );
            if (foundProc) firstProcessName = foundProc.process_name ?? null;
          }
        }
      }

      // Parent: collect ALL process names from the BOM node (like child rows),
      // falling back to the precomputed process map.
      const parentProcessesDirect = getAllProcessNames(bomNode);
      const mapped = bomProcessMap[uniq];
      const parentAllProcesses =
        parentProcessesDirect.length > 0
          ? parentProcessesDirect
          : Array.isArray(mapped)
            ? mapped
            : [];
      const firstFromMap =
        Array.isArray(mapped) && mapped.length ? mapped[0] : null;
      const resolvedFirstProcess =
        firstProcessName ?? parentAllProcesses[0] ?? firstFromMap ?? undefined;
      if (resolvedFirstProcess || parentAllProcesses.length) {
        updateLine(id, {
          process: resolvedFirstProcess,
          processes: parentAllProcesses,
        });
      }

      const nodeUom = String(
        bomNode.unit_measurement ??
          bomNode.unitMeasurement ??
          bomNode.uom ??
          bomNode.unit ??
          "",
      ).trim();
      if (nodeUom) updateLine(id, { uom: nodeUom });

      const nodeStock = (bomNode.stock_qty ??
        bomNode.stock ??
        bomNode.stockQty ??
        bomNode.quantity ??
        null) as any;
      const stockFromBom =
        typeof nodeStock === "number"
          ? nodeStock
          : typeof nodeStock === "string" && nodeStock.trim()
            ? Number(nodeStock)
            : null;
      updateLine(id, {
        stockQty: typeof stockFromBom === "number" ? stockFromBom : 0,
      });
    }

    // --- Helper: build child UniqLine[] dari children array (detail endpoint) ---
    const buildChildLines = (detailChildren: any[]): UniqLine[] =>
      detailChildren.map((c: any, idx: number) => {
        const childUniq = String(
          c?.uniq ?? c?.uniq_code ?? c?.uniqCode ?? "",
        ).trim();
        // qty: pakai quantity (sudah di-map dari qty_per_uniq oleh mapNewNodeToLegacy) atau fallback
        const rawQty =
          c?.quantity ??
          c?.qty_per_uniq ??
          c?.qty ??
          c?.bom_qty ??
          c?.component_qty ??
          c?.required_qty ??
          c?.bom_quantity ??
          null;
        const childQty: number | undefined =
          typeof rawQty === "number"
            ? rawQty
            : typeof rawQty === "string" && rawQty.trim() !== ""
              ? Number(rawQty)
              : undefined;
        // process: dari detail children yang sudah punya process_routes
        const childProcessesDirect = getAllProcessNames(c);
        const childProcessesFromMap = bomProcessMap[childUniq] ?? [];
        const childAllProcesses: string[] =
          childProcessesDirect.length > 0
            ? childProcessesDirect
            : childProcessesFromMap.length > 0
              ? childProcessesFromMap
              : [];
        return {
          id: `l-${Date.now()}-${idx}`,
          parentId: id,
          uniq: childUniq || undefined,
          partName: String(c?.part_name ?? "") || undefined,
          partNumber: String(c?.part_number ?? "") || undefined,
          model: String(c?.model ?? c?.assembly_code ?? "") || undefined,
          qty: childQty,
          qpu:
            typeof rawQty === "number"
              ? rawQty
              : typeof rawQty === "string" && rawQty.trim() !== ""
                ? Number(rawQty)
                : null,
          uom: String(c?.unit_measurement ?? c?.uom ?? "pcs") || undefined,
          process: childAllProcesses[0] ?? undefined,
          processes: childAllProcesses,
          kanbanNumber: nextKanbanNumber(idx + 1),
          level: typeof c?.level === "number" ? c.level : 1,
        };
      });

    // --- Helper: apply child lines ke state ---
    const applyChildLines = (detailChildren: any[], detailRoot?: any) => {
      if (!detailChildren.length) return;
      setLines((prev) => {
        const baseLines = prev.filter((l) => l.id !== id && l.parentId !== id);
        // QPU untuk parent: ambil dari qty_per_uniq di BOM node jika ada
        const parentQpu =
          bomNode?.qty_per_uniq ?? bomNode?.qpu ?? bomNode?.qty ?? null;
        // Parent process(es): utamakan routes dari root node detail (/full),
        // lalu node tree, terakhir fallback ke map.
        const parentProcessesFromDetail = getAllProcessNames(detailRoot);
        const parentProcessesFromNode = getAllProcessNames(bomNode);
        const parentProcesses =
          parentProcessesFromDetail.length > 0
            ? parentProcessesFromDetail
            : parentProcessesFromNode.length > 0
              ? parentProcessesFromNode
              : (bomProcessMap[uniq] ?? []);
        const parentLine: UniqLine = {
          id,
          uniq,
          partName: found?.partName,
          partNumber: found?.partNumber,
          model: found?.model,
          qty: undefined,
          qpu: typeof parentQpu === "number" ? parentQpu : null,
          uom: found?.uom ?? bomIndex.uomByUniq[uniq] ?? "pcs",
          process: parentProcesses[0] ?? bomProcessMap[uniq]?.[0] ?? undefined,
          processes: parentProcesses,
          kanbanNumber: nextKanbanNumber(0),
        };
        const childLines = buildChildLines(detailChildren);
        const merged = [parentLine, ...childLines, ...baseLines];
        return merged.map((l, idx) => ({
          ...l,
          kanbanNumber: nextKanbanNumber(idx),
        }));
      });
    };

    // Shallow children dari cache list (tidak punya process_routes)
    const shallowChildren = Array.isArray(bomNode?.children)
      ? bomNode.children
      : [];
    // bom_id untuk fetch detail endpoint yang punya process_routes per child
    const bomId = bomNode?.bom_id ? String(bomNode.bom_id).trim() : "";

    if (apiEnabled && bomId) {
      // PENTING: list endpoint tidak return process_routes di children.
      // Harus fetch /products/bom/{bom_id} (detail) untuk dapat process_routes.
      void (async () => {
        try {
          let detail: any = null;
          try {
            const headers = await generateHeaders({ useAuthorization: true });
            // Pakai endpoint /full agar process_routes milik node PARENT (root) ikut
            // terbawa, sama seperti halaman BOM Detail. Endpoint non-full tidak
            // mengembalikan process_routes milik parent.
            const res = await fetch(
              `${apiBaseUrl}/products/bom/${encodeURIComponent(bomId)}/full`,
              { method: "GET", headers },
            );
            if (res.ok) detail = await res.json();
          } catch (e) {
            detail = null;
          }
          const detailData = detail?.data ?? detail;
          // Auto-fill process milik PARENT dari root node detail
          // (mis. "Spot Welding" untuk BT333).
          const parentProcessesFromDetail = getAllProcessNames(detailData);
          if (parentProcessesFromDetail.length) {
            updateLine(id, {
              process: parentProcessesFromDetail[0],
              processes: parentProcessesFromDetail,
            });
          }
          const detailChildren =
            Array.isArray(detailData?.children) &&
            (detailData.children as any[]).length > 0
              ? (detailData.children as any[])
              : shallowChildren;
          applyChildLines(detailChildren, detailData);
        } catch {
          // fallback ke shallow jika fetch gagal
          if (shallowChildren.length) applyChildLines(shallowChildren);
        }
        // kanban summary
        try {
          const kanbanRes = await getInventoryKanbanSummary({ uniq_code: uniq })
            .unwrap()
            .catch(() => null);
          const kanbanData = (kanbanRes as any)?.data ?? null;
          const targetFromKanban =
            kanbanData?.kanban_pkg_qty ?? kanbanData?.safety_stock_qty ?? null;
          if (typeof targetFromKanban === "number")
            updateLine(id, { targetStock: targetFromKanban });
        } catch {
          /* ignore */
        }
      })();
      if (shallowChildren.length) return; // children akan diisi oleh async di atas
    } else if (shallowChildren.length) {
      applyChildLines(shallowChildren);
      return;
    }

    if (apiEnabled && uniq) {
      void (async () => {
        try {
          const kanbanPromise = getInventoryKanbanSummary({
            uniq_code: uniq,
          }).unwrap();
          const kanbanRes = await kanbanPromise.catch(() => null);
          const kanbanData = kanbanRes?.data ?? null;
          const kanbanPkg = kanbanData?.kanban_pkg_qty ?? null;
          const safety = kanbanData?.safety_stock_qty ?? null;
          const targetFromKanban = kanbanPkg ?? safety ?? null;
          if (
            targetFromKanban !== null &&
            typeof targetFromKanban === "number"
          ) {
            updateLine(id, { targetStock: targetFromKanban });
          }
        } catch (e) {
          /* ignore */
        }
      })();

      setRequestedFinished({ id, uniq });
    }
  };

  useEffect(() => {
    if (!requestedFinished) return;
    if (finishedQuery.isError) {
      setRequestedFinished(null);
      return;
    }
    if (finishedQuery.data) {
      const finishedData = finishedQuery.data;
      const targetFromFinished =
        (finishedData as any)?.target_stock_qty ??
        (finishedData as any)?.targetStockQty ??
        null;
      const stockQty =
        (finishedData as any)?.stock_qty ??
        (finishedData as any)?.stockQty ??
        null;
      updateLine(requestedFinished.id, {
        targetStock:
          typeof targetFromFinished === "number" ? targetFromFinished : null,
        stockQty: typeof stockQty === "number" ? stockQty : null,
      });
      setRequestedFinished(null);
    }
  }, [finishedQuery.data, finishedQuery.isError, requestedFinished]);

  // [wo-estimated-time] Estimasi waktu (menit) = SUM(qty x cycle time menit x machine capacity).
  // Dihitung ulang otomatis setiap qty / uniq berubah (on change).
  const estimatedTimeBreakdown = useMemo(() => {
    let total = 0;
    let cycleMin: number | undefined;
    let capacity: number | undefined;
    for (const l of lines) {
      // Child ikut dihitung: tiap child punya uniq + qty (qty x qpu) sendiri.
      const info = l.uniq ? bomTimeMap[l.uniq] : undefined;
      const qty =
        typeof l.qty === "number" && Number.isFinite(l.qty) ? l.qty : 0;
      if (!info || qty <= 0) continue;
      total += qty * info.cycleMin * info.machineCapacity;
      if (cycleMin === undefined) {
        cycleMin = info.cycleMin;
        capacity = info.machineCapacity;
      }
    }
    return { total: Math.round(total * 100) / 100, cycleMin, capacity };
  }, [lines, bomTimeMap]);

  // [wo-estimated-time] Read-only: tidak bisa diketik, selalu auto-calculated.
  const estimatedTimeMinutes = estimatedTimeBreakdown.total;

  // Estimasi waktu per baris = qty x cycle time (menit) x machine capacity.
  const lineEstimatedMinutes = (l: UniqLine) => {
    const info = l.uniq ? bomTimeMap[l.uniq] : undefined;
    const qty = typeof l.qty === "number" && Number.isFinite(l.qty) ? l.qty : 0;
    if (!info || qty <= 0) return 0;
    return Math.round(qty * info.cycleMin * info.machineCapacity * 100) / 100;
  };

  const validateLines = () => {
    for (const l of lines) {
      if (!l.uniq) return "Select UNIQ";
      // Child rows tidak perlu qty/uom/process divalidasi secara individual
      if (!l.parentId) {
        if (!l.qty || l.qty <= 0) return "Enter Qty";
        if (!l.uom) return "Select UoM";
        if (!l.process) return "Select Process";
      }
    }
    return null;
  };

  const onCreate = async () => {
    try {
      const values = await form.validateFields();
      const lineError = validateLines();
      if (lineError) {
        message.error(lineError);
        return;
      }

      if (!apiEnabled) {
        message.success("Work order created (mock)");
        router.push("/work-orders");
        return;
      }

      const targetDate = values.woTargetDate as Dayjs;
      const createdDate = values.woCreatedDate as Dayjs;
      const created = await createWorkOrder({
        wo_type: String(values.woType),
        reference_wo: values.woReference ? String(values.woReference) : null,
        created_date: dayjs(createdDate).format("YYYY-MM-DD"),
        target_date: dayjs(targetDate).format("YYYY-MM-DD"),
        items: lines.map((line) => ({
          item_uniq_code: String(line.uniq ?? "").trim(),
          quantity: Number(line.qty ?? 0),
          uom: String(line.uom ?? "pcs"),
          process_name: String(line.process ?? ""),
        })),
        notes: values.woNotes ? String(values.woNotes) : null,
        // [wo-estimated-time]
        estimated_time_minutes:
          estimatedTimeMinutes > 0 ? estimatedTimeMinutes : null,
        cycle_time_min: estimatedTimeBreakdown.cycleMin ?? null,
        machine_capacity: estimatedTimeBreakdown.capacity ?? null,
      }).unwrap();

      message.success("Work order created successfully");
      if (created.id) {
        router.push(`/work-orders/detail/${encodeURIComponent(created.id)}`);
        return;
      }

      router.push("/work-orders");
      void values;
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      if (err)
        message.error(getApiErrorMessage(err, "Failed to create work order"));
    }
  };

  const selectedWoType = Form.useWatch("woType", form) as
    WorkOrderType | undefined;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/work-orders")}
          >
            <ArrowLeftOutlined />
            <span>Back to Work Orders</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => router.push("/work-orders")}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={onCreate}
              loading={createWorkOrderState.isLoading}
            >
              Create Work Order
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">
            Create New Work Order
          </div>
          <div className="text-sm text-gray-500">
            Generate work order with Kanban barcode integration
          </div>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">
              Work Order Details
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Configure basic work order information and product details
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Form.Item
                  name="woNumber"
                  label="Work Order Number"
                  rules={[{ required: true }]}
                >
                  <Input
                    className="!rounded-lg"
                    disabled
                    placeholder="WO-2024-006"
                  />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">
                  Auto-generated on save
                </div>
              </div>

              <Form.Item
                name="woCreatedDate"
                label="Created Date"
                rules={[{ required: true, message: "Select created date" }]}
                initialValue={dayjs()}
              >
                <DatePicker
                  className="!rounded-lg w-full"
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                />
              </Form.Item>

              <Form.Item
                name="woType"
                label="Work Order Type"
                rules={[{ required: true, message: "Select type" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select type"
                  options={[
                    { label: "New", value: "New" },
                    { label: "Additional", value: "Additional" },
                    { label: "Assembly", value: "Assembly" },
                    { label: "Rework", value: "Rework" },
                  ]}
                />
              </Form.Item>

              <div className="md:col-span-2">
                <Form.Item
                  name="woReference"
                  label="WO Reference (for Additional type)"
                >
                  <Select
                    className="!rounded-lg"
                    placeholder="Select reference WO (only for Additional)"
                    disabled={selectedWoType !== "Additional"}
                    options={[
                      { label: "WO-2024-001", value: "WO-2024-001" },
                      { label: "WO-2024-002", value: "WO-2024-002" },
                      { label: "WO-2024-003", value: "WO-2024-003" },
                    ]}
                  />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">
                  Only applicable when WO Type = Additional
                </div>
              </div>

              <div className="md:col-span-2">
                <Form.Item name="woNotes" label="Notes">
                  <TextArea
                    className="!rounded-lg"
                    rows={3}
                    placeholder="WO harian shift 1"
                  />
                </Form.Item>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Products &amp; UNIQs
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Add multiple UNIQs to this work order (1 UNIQ = 1 Kanban)
                </div>
              </div>
              <Button
                className="!rounded-lg"
                icon={<PlusOutlined />}
                onClick={addLine}
              >
                Add UNIQ
              </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              {/* Header */}
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600 grid grid-cols-12 gap-3">
                <div className="col-span-2">UNIQ</div>
                <div className="col-span-1">Part Name</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2">Estimasi Waktu (menit)</div>
                <div className="col-span-1">UoM</div>
                <div className="col-span-2">Process Name</div>
                <div className="col-span-1">Kanban</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              <div className="divide-y divide-gray-100">
                {lines.map((l, idx) => {
                  const isChild = (l.level ?? 0) > 0;
                  const selectedUniq = uniqOptions.find(
                    (u) => u.uniq === l.uniq,
                  );
                  const processOptions = (
                    selectedUniq?.processes.length
                      ? selectedUniq.processes
                      : processNameOptions
                  ).map((p) => ({ label: p, value: p }));

                  return (
                    // FIX #2: Child row menjorok ke dalam dengan border kiri biru + background beda
                    <div
                      key={l.id}
                      className={[
                        "px-4 py-3 grid grid-cols-12 gap-3 items-start",
                        isChild
                          ? "bg-blue-50/40 border-l-4 border-l-blue-300 pl-8"
                          : "bg-white",
                      ].join(" ")}
                    >
                      {/* UNIQ */}
                      <div className="col-span-2">
                        {isChild ? (
                          // Child: tampilkan UNIQ sebagai text saja (read-only)
                          <div className="flex items-center gap-1">
                            <span className="text-blue-400 text-xs">↳</span>
                            <span className="text-xs text-gray-600 font-mono">
                              {l.uniq ?? "-"}
                            </span>
                          </div>
                        ) : (
                          <Select
                            className="!rounded-lg w-full"
                            placeholder="Search UNIQ"
                            value={l.uniq}
                            options={uniqSelectOptions}
                            showSearch
                            allowClear
                            optionFilterProp="label"
                            filterOption={(input, option) => {
                              const label = String(
                                option?.label ?? "",
                              ).toLowerCase();
                              const value = String(
                                option?.value ?? "",
                              ).toLowerCase();
                              const search = input.trim().toLowerCase();
                              return (
                                label.includes(search) || value.includes(search)
                              );
                            }}
                            notFoundContent="No UNIQ found"
                            onChange={(v) => onSelectUniq(l.id, v)}
                          />
                        )}
                      </div>

                      {/* Part Name */}
                      <div className="col-span-1">
                        <div className="flex items-center gap-2">
                          <Input
                            className="!rounded-lg"
                            value={l.partName}
                            placeholder="Auto-filled from BOM"
                            disabled
                          />
                        </div>
                        {(l.partNumber || l.model) && (
                          <div className="mt-1 text-[11px] text-gray-400">
                            {[
                              l.partNumber ? `Part No: ${l.partNumber}` : "",
                              l.model ? `Model: ${l.model}` : "",
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <InputNumber
                            className="!rounded-lg flex-1 min-w-0"
                            placeholder="Qty"
                            min={0}
                            value={l.qty}
                            onChange={(v) =>
                              updateLine(l.id, {
                                qty: typeof v === "number" ? v : undefined,
                              })
                            }
                          />
                          <Tooltip
                            placement="right"
                            title={
                              <div className="text-xs space-y-1">
                                <div>
                                  <span className="text-gray-300">
                                    QPU:&nbsp;
                                  </span>
                                  <span className="font-semibold text-white">
                                    {l.qpu != null ? String(l.qpu) : "-"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-300">
                                    Stock:&nbsp;
                                  </span>
                                  <span className="font-semibold text-white">
                                    {l.stockQty != null
                                      ? String(l.stockQty)
                                      : "0"}
                                  </span>
                                </div>
                              </div>
                            }
                          >
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 cursor-pointer hover:bg-blue-200 transition-colors flex-shrink-0">
                              <ExclamationCircleOutlined
                                style={{ fontSize: 11 }}
                              />
                            </span>
                          </Tooltip>
                        </div>
                        {!isChild && (
                          <div className="mt-1 text-[11px] text-gray-500">
                            <div>
                              Target Stock:{" "}
                              {l.targetStock !== undefined &&
                              l.targetStock !== null
                                ? String(l.targetStock)
                                : "-"}
                            </div>
                            <div>
                              Stock Qty:{" "}
                              {l.stockQty !== undefined && l.stockQty !== null
                                ? String(l.stockQty)
                                : "0"}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* [wo-estimated-time] Read-only, auto-calculated dari qty x cycle time x machine capacity */}
                      <div className="col-span-2">
                        <Input
                          className="!rounded-lg"
                          value={`${lineEstimatedMinutes(l)} menit`}
                          readOnly
                          disabled
                        />
                        <div className="mt-1 text-[11px] text-gray-400">
                          {l.uniq && bomTimeMap[l.uniq]
                            ? `Cycle ${bomTimeMap[l.uniq].cycleMin} mnt x kapasitas ${bomTimeMap[l.uniq].machineCapacity} x qty`
                            : "Cycle time BOM belum diisi"}
                        </div>
                      </div>

                      {/* UoM */}
                      <div className="col-span-1">
                        <Select
                          className="!rounded-lg w-full"
                          placeholder="UoM"
                          value={l.uom}
                          options={[
                            { label: "pcs", value: "pcs" },
                            { label: "set", value: "set" },
                            { label: "kg", value: "kg" },
                          ]}
                          onChange={(v) => updateLine(l.id, { uom: v })}
                          disabled={isChild}
                        />
                      </div>

                      {/* Process Name */}
                      {/* FIX #1: Child tampilkan SEMUA process dari BOM sebagai tags */}
                      <div className="col-span-2">
                        {isChild ? (
                          <div className="flex flex-wrap gap-1">
                            {l.processes && l.processes.length > 0 ? (
                              l.processes.map((p, pi) => (
                                <Tag
                                  key={pi}
                                  color="blue"
                                  className="text-[11px] m-0"
                                >
                                  {p}
                                </Tag>
                              ))
                            ) : l.process ? (
                              <Tag color="blue" className="text-[11px] m-0">
                                {l.process}
                              </Tag>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        ) : l.processes && l.processes.length > 1 ? (
                          // Parent with multiple processes from BOM: show all as tags
                          <div className="flex flex-wrap gap-1">
                            {l.processes.map((p, pi) => (
                              <Tag
                                key={pi}
                                color="geekblue"
                                className="text-[11px] m-0"
                              >
                                {p}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <Select
                            className="!rounded-lg w-full"
                            placeholder="Process"
                            showSearch={false}
                            value={l.process}
                            options={processOptions}
                            onChange={(v) => updateLine(l.id, { process: v })}
                            disabled={!l.uniq || !processOptions.length}
                          />
                        )}
                      </div>

                      {/* Kanban Number */}
                      <div className="col-span-1">
                        <Input
                          className="!rounded-lg"
                          value={l.kanbanNumber}
                          disabled
                        />
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex justify-end">
                        {/* Child tidak punya tombol delete sendiri (ikut parent) */}
                        {!isChild && (
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeLine(l.id)}
                            aria-label={`delete-line-${idx}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">
              Production Scheduling
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Set production timeline and target dates
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="woCreatedDate"
                label="WO Created Date"
                rules={[{ required: true, message: "Select created date" }]}
              >
                <DatePicker
                  className="!rounded-lg w-full"
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                />
              </Form.Item>
              <Form.Item
                name="woTargetDate"
                label="WO Target Date"
                rules={[{ required: true, message: "Select target date" }]}
              >
                <DatePicker
                  className="!rounded-lg w-full"
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                />
              </Form.Item>

              <div>
                <Form.Item name="woScanStartDate" label="WO Scan Start Date">
                  <DatePicker
                    className="!rounded-lg w-full"
                    placeholder="dd/mm/yyyy"
                    disabled
                    format="DD/MM/YYYY"
                  />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">
                  Date when scanning started
                </div>
              </div>
              <div>
                <Form.Item name="woCloseDate" label="WO Close Date">
                  <DatePicker
                    className="!rounded-lg w-full"
                    placeholder="dd/mm/yyyy"
                    disabled
                    format="DD/MM/YYYY"
                  />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">
                  Date when WO completed
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              <span className="font-semibold">Aging Calculation:</span> WO
              Created Date - WO Scan Date = Aging (days)
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}
