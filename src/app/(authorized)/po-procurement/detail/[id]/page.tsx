"use client";

import { useEffect, useMemo } from "react";
import { Button, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LeftOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetProcurementPoByIdQuery } from "@/lib/api/procurement-po/api";
import { getApiErrorMessage } from "@/lib/api/error";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean => {
  if (!isRecord(error)) return false;
  return (error as UnknownRecord).status === 404;
};

type PoItemRow = {
  key: string;
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  qty: number;
  uom: string;
  packingNumber: string;
  pcsPerKanban: number;
  budgetPoIdr: number;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);
const formatIdr = (n: number) => `${formatNumber(n)} IDR`;

function buildMock(id: string) {
  const itemBase: Omit<PoItemRow, "key">[] = [
    {
      uniq: "LV-001",
      partNumber: "SP-001-A",
      partName: "Steel Plate",
      model: "Camry 2024",
      qty: 100,
      uom: "pcs",
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 20,
      budgetPoIdr: 100_000_000,
    },
    {
      uniq: "LV-001",
      partNumber: "SP-001-A",
      partName: "Steel Plate",
      model: "Camry 2024",
      qty: 100,
      uom: "pcs",
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 20,
      budgetPoIdr: 10_000_000,
    },
    {
      uniq: "LV-001",
      partNumber: "SP-001-A",
      partName: "Steel Plate",
      model: "Camry 2024",
      qty: 100,
      uom: "pcs",
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 20,
      budgetPoIdr: 5_000_000,
    },
    {
      uniq: "LV-001",
      partNumber: "SP-001-A",
      partName: "Steel Plate",
      model: "Camry 2024",
      qty: 100,
      uom: "pcs",
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 20,
      budgetPoIdr: 20_000_000,
    },
    {
      uniq: "LV-001",
      partNumber: "SP-001-A",
      partName: "Steel Plate",
      model: "Camry 2024",
      qty: 100,
      uom: "pcs",
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 20,
      budgetPoIdr: 90_000_000,
    },
  ];

  const items: PoItemRow[] = itemBase.map((r, idx) => ({ ...r, key: `${id}-${idx + 1}` }));

  return {
    period: "01/2024",
    poNumber: id,
    poBudgetNumber: "POB-2024-RM-X",
    totalBudgetPo: 250_000_000,
    supplier: "PT Supplier Raw Material",
    totalQuantity: 3000,
    dnCreated: 10,
    dnIncoming: 3,
    status: "-",
    expectedArrival: "-",
    dateIncoming: "-",
    notes: "-",
    items,
  };
}

export default function PoProcurementDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? "PO-RM-XXX");

  const apiEnabled = Boolean(apiBaseUrl);
  const poQuery = useGetProcurementPoByIdQuery(id, { skip: !apiEnabled });

  const procurementApiAvailable = apiEnabled && !isMissingRouteError(poQuery.error);

  useEffect(() => {
    if (!apiEnabled) return;
    if (!poQuery.error) return;
    if (isMissingRouteError(poQuery.error)) {
      message.warning("Procurement PO API route is not available on this backend yet; showing mock data.");
      return;
    }
    message.error(getApiErrorMessage(poQuery.error, "Failed to load PO detail"));
  }, [apiEnabled, poQuery.error]);

  const detail = useMemo(() => {
    if (!procurementApiAvailable) return buildMock(id);
    const po = poQuery.data?.data;
    if (!po) return buildMock(id);

    const supplier = po.po_category === "SUBCON" ? po.subcon_name ?? po.supplier_name : po.supplier_name;

    return {
      period: po.month ?? "-",
      poNumber: po.po_number ?? po.id,
      poBudgetNumber: po.data_order ?? "-",
      totalBudgetPo: Number(po.total_po ?? 0),
      supplier: supplier ?? "-",
      totalQuantity: Number(po.total_po ?? 0),
      dnCreated: Number(po.dn_created ?? 0),
      dnIncoming: Number(po.dn_incoming ?? 0),
      status: po.status ?? "-",
      expectedArrival: po.expected_arrival ?? "-",
      dateIncoming: po.date_incoming ?? "-",
      notes: po.notes ?? "-",
      items: [] as PoItemRow[],
    };
  }, [procurementApiAvailable, id, poQuery.data?.data]);

  const items = detail.items;

  const columns: ColumnsType<PoItemRow> = [
    { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 90 },
    { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 120 },
    { title: "Part Name", dataIndex: "partName", key: "partName", width: 140 },
    { title: "Model", dataIndex: "model", key: "model", width: 110 },
    { title: "Qty", dataIndex: "qty", key: "qty", width: 80 },
    { title: "UoM", dataIndex: "uom", key: "uom", width: 80 },
    {
      title: "Packing Number",
      dataIndex: "packingNumber",
      key: "packingNumber",
      width: 140,
      render: (v: string) => <span className="text-blue-600">{v}</span>,
    },
    { title: "Pcs/Kanban", dataIndex: "pcsPerKanban", key: "pcsPerKanban", width: 110 },
    {
      title: "Budget PO",
      dataIndex: "budgetPoIdr",
      key: "budgetPoIdr",
      width: 140,
      align: "right",
      render: (v: number) => <span className="text-xs text-gray-700">{formatIdr(v)}</span>,
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push("/po-procurement")}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <LeftOutlined />
          Back to Raw Material
        </button>

        <div className="text-xl font-bold text-gray-900">PO Raw Material Details</div>

        <div />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-6xl mx-auto">
        <div>
          <div className="text-lg font-bold text-gray-900">Details &amp; History Logs</div>
          <div className="text-xs text-gray-500 mt-1">
            Complete PO Raw Material Information for {detail.poNumber}
            {apiEnabled && poQuery.isFetching && <span className="ml-2 text-gray-400">(Loading…)</span>}
          </div>
        </div>

        <div className="mt-4 border-b border-gray-100">
          <div className="inline-flex items-center gap-2 border-b-2 border-blue-600 pb-2">
            <span className="text-blue-600">▣</span>
            <span className="text-sm font-semibold text-blue-700">Details</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-4">
          <div>
            <div className="text-xs text-gray-500">Period</div>
            <div className="text-sm font-medium text-gray-900">{detail.period}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">PO Number</div>
            <div className="text-sm font-medium text-gray-900">{detail.poNumber}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">PO Budget Number</div>
            <div className="text-sm font-medium text-gray-900">{detail.poBudgetNumber}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Total Budget PO</div>
            <div className="text-sm font-medium text-gray-900">{formatNumber(detail.totalBudgetPo)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Supplier</div>
            <div className="text-sm font-medium text-gray-900">{detail.supplier}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Quantity</div>
            <div className="text-sm font-medium text-gray-900">{formatNumber(detail.totalQuantity)}</div>

          {apiEnabled && (
            <>
              <div>
                <div className="text-xs text-gray-500">Date Incoming</div>
                <div className="text-sm font-medium text-gray-900">{detail.dateIncoming}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Expected Arrival</div>
                <div className="text-sm font-medium text-gray-900">{detail.expectedArrival}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="text-sm font-medium text-gray-900">{detail.status}</div>
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-gray-500">Notes</div>
                <div className="text-sm font-medium text-gray-900">{detail.notes}</div>
              </div>
            </>
          )}
          </div>

          <div>
            <div className="text-xs text-gray-500">DN Created</div>
            <div className="text-sm font-medium text-gray-900">{formatNumber(detail.dnCreated)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">DN Incoming</div>
            <div className="text-sm font-medium text-gray-900">{formatNumber(detail.dnIncoming)}</div>
          </div>
          <div className="flex items-end justify-start">
            <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
              Details
            </Tag>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
          <Table<PoItemRow>
            columns={columns}
            dataSource={items}
            rowKey="key"
            size="middle"
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>

        {apiEnabled && items.length === 0 && (
          <div className="mt-3 text-xs text-gray-500">
            Item rows are not provided by this endpoint.
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          <Button className="!rounded-lg" onClick={() => router.push("/po-procurement")}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
