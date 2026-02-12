import type { BackendBomNode } from "@/lib/api/bom/api";

// Fallback BOM data for UI-only mode (when NEXT_PUBLIC_API_URL is not set).
// Keep this lightweight and consistent with the Bill of Material mock dataset.
export const mockBomTree: BackendBomNode[] = [
  {
    id: "LV7-001",
    assembly_code: "LV7-001",
    uniq: "LV7-001",
    part_name: "Engine Mount Assembly",
    part_number: "EMA-001-LV7",
    status: "Active",
    children: [
      {
        id: "LV7-001-A",
        assembly_code: "LV7-001-A",
        uniq: "LV7-001-A",
        part_name: "Main Bracket",
        part_number: "MB-001-LV7",
        status: "Active",
        children: [],
      },
      {
        id: "LV7-001-B",
        assembly_code: "LV7-001-B",
        uniq: "LV7-001-B",
        part_name: "Rubber Insulator",
        part_number: "RI-002-LV7",
        status: "Active",
        children: [],
      },
      {
        id: "LV7-001-C",
        assembly_code: "LV7-001-C",
        uniq: "LV7-001-C",
        part_name: "Bolt Assembly",
        part_number: "BA-003-LV7",
        status: "Active",
        children: [],
      },
    ],
  },
  {
    id: "LV8-002",
    assembly_code: "LV8-002",
    uniq: "LV8-002",
    part_name: "Suspension Arm",
    part_number: "SA-002-LV8",
    status: "Active",
    children: [],
  },
  {
    id: "LV9-003",
    assembly_code: "LV9-003",
    uniq: "LV9-003",
    part_name: "Brake Assembly",
    part_number: "BRA-003-LV9",
    status: "Active",
    children: [],
  },
];
