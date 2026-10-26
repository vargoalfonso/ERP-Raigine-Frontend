/**
 * Data waktu per UNIQ dari BOM tree (dipakai untuk estimasi waktu Work Order).
 *
 * - cycleMin : cycle time per 1 qty dalam MENIT (BOM menyimpan detik).
 * - setupMin : setup time default UNIQ (menit), dipakai bila proses yang
 *              sedang berjalan tidak ketemu di route BOM.
 * - routes   : setup time (menit) per proses/route BOM.
 *
 * Urutan sumber cycle/setup default sama dengan halaman create Work Order:
 * material_spec -> node -> process_routes[0].
 */
export type BomRouteTime = {
  opSeq: number | null;
  processName: string;
  setupMin: number;
};

export type BomUniqTime = {
  cycleMin: number;
  setupMin: number;
  routes: BomRouteTime[];
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object";

const pickPositive = (...values: unknown[]): number => {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export const normalizeProcessName = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const buildBomTimeIndex = (tree: unknown): Record<string, BomUniqTime> => {
  const map: Record<string, BomUniqTime> = {};

  const extract = (raw: unknown) => {
    if (!isRecord(raw)) return;
    const uniq = String(raw.uniq ?? raw.uniq_code ?? raw.uniqCode ?? "").trim();
    if (!uniq || uniq in map) return;

    const spec = (raw.material_spec ??
      raw.materialSpec ??
      raw.material_specifications ??
      {}) as Record<string, unknown>;
    const routeList: unknown[] = Array.isArray(raw.process_routes)
      ? raw.process_routes
      : Array.isArray(raw.processRoutes)
        ? raw.processRoutes
        : [];
    const firstRoute = (
      isRecord(routeList[0]) ? routeList[0] : {}
    ) as Record<string, unknown>;

    const cycleSec = pickPositive(
      spec?.cycle_time_sec,
      spec?.cycle_time_sec_per_pc,
      raw.cycle_time_sec,
      firstRoute.cycle_time_sec,
    );
    if (cycleSec <= 0) return;

    const setupMin = pickPositive(
      spec?.setup_time_min,
      raw.setup_time_min,
      firstRoute.setup_time_min,
    );

    const routes: BomRouteTime[] = routeList.flatMap((r) => {
      if (!isRecord(r)) return [];
      const seq = Number(r.op_seq ?? r.opSeq);
      return [
        {
          opSeq: Number.isFinite(seq) ? seq : null,
          processName: String(r.process_name ?? r.processName ?? "").trim(),
          setupMin: pickPositive(r.setup_time_min, r.setupTimeMin),
        },
      ];
    });

    map[uniq] = {
      cycleMin: round4(cycleSec / 60),
      setupMin: round4(setupMin),
      routes,
    };
  };

  const walk = (node: unknown) => {
    extract(node);
    if (isRecord(node) && Array.isArray(node.children)) {
      for (const c of node.children) walk(c);
    }
  };

  // Query BOM tree membungkus node sebagai { items: [...] } (lihat ok() di
  // bom/api.ts). Normalisasi: array, { items }, { data: [...] },
  // { data: { items } }, atau satu node.
  const toNodeArray = (input: unknown): unknown[] => {
    if (Array.isArray(input)) return input;
    if (!isRecord(input)) return [];
    if (Array.isArray(input.items)) return input.items;
    const data = input.data;
    if (Array.isArray(data)) return data;
    if (isRecord(data) && Array.isArray(data.items)) return data.items;
    return [input];
  };

  for (const n of toNodeArray(tree)) walk(n);
  return map;
};
