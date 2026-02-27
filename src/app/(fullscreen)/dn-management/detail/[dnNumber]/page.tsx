"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Modal, QRCode } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { encodeBarcodePayload } from "@/lib/utils/barcodePayload";

type DetailTabId = "details";

type DnDetailItem = {
  key: string;
  uniq: string;
  materialInfo: {
    code: string;
    name: string;
    model: string;
  };
  totalQty: number;
  remainingQty: number;
  uom: string;
  orderQty: number;
  packingNumber: string;
  pcsPerKanban: number;
  dateIncoming: string;
};

function mockDnHeader(dnNumber: string) {
  return {
    period: "01/2024",
    poNumber: "PO-RM-XXX",
    supplier: "PT Supplier",
    totalPo: 1000,
    totalIncoming: 250,
    dnCreated: 10,
    dnIncoming: 8,
    dnCode: `DN-RM-${dnNumber}`,
  };
}

function mockItems(): DnDetailItem[] {
  return [
    {
      key: "LV-001",
      uniq: "LV-001",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      totalQty: 120,
      remainingQty: 40,
      uom: "pcs",
      orderQty: 40,
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 40,
      dateIncoming: "1/19/2024",
    },
    {
      key: "LV-002",
      uniq: "LV-002",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      totalQty: 100,
      remainingQty: 50,
      uom: "pcs",
      orderQty: 100,
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 50,
      dateIncoming: "1/19/2024",
    },
    {
      key: "LV-003",
      uniq: "LV-003",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      totalQty: 200,
      remainingQty: 100,
      uom: "pcs",
      orderQty: 100,
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 100,
      dateIncoming: "1/20/2024",
    },
    {
      key: "LV-004",
      uniq: "LV-004",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      totalQty: 200,
      remainingQty: 100,
      uom: "pcs",
      orderQty: 100,
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 100,
      dateIncoming: "1/25/2024",
    },
  ];
}

export default function DnRawMaterialDetailPage() {
  const router = useRouter();
  const params = useParams<{ dnNumber: string }>();
  const dnNumber = params?.dnNumber ?? "XXX";

  const header = useMemo(() => mockDnHeader(dnNumber), [dnNumber]);
  const [activeTab, setActiveTab] = useState<DetailTabId>("details");

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const items = useMemo(() => mockItems(), []);

  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeItem, setBarcodeItem] = useState<DnDetailItem | null>(null);

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(items.map((i) => i.key)));
  };

  const toggleOne = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const allChecked = items.length > 0 && selectedKeys.size === items.length;

  const openBarcode = (item: DnDetailItem) => {
    setBarcodeItem(item);
    setBarcodeOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push("/dn-management")}
            >
              <LeftOutlined />
              <span>Back to Raw Material</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/dn-management")}>Close</Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">DN Raw Material Details</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div>
              <div className="text-base font-semibold text-gray-900">Details & History Logs</div>
              <div className="text-sm text-gray-500">Complete DN Raw Material Information for {header.dnCode}</div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-6 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className={`pb-3 text-sm font-medium ${
                    activeTab === "details" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"
                  }`}
                >
                  Details
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-6">
                <div>
                  <div className="text-xs text-gray-500">Period</div>
                  <div className="text-sm font-medium text-gray-900">{header.period}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">PO Number</div>
                  <div className="text-sm font-medium text-gray-900">{header.poNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Supplier</div>
                  <div className="text-sm font-medium text-gray-900">{header.supplier}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total PO</div>
                  <div className="text-sm font-medium text-gray-900">{header.totalPo}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total Incoming</div>
                  <div className="text-sm font-medium text-gray-900">{header.totalIncoming}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">DN Incoming</div>
                  <div className="text-sm font-medium text-gray-900">{header.dnIncoming}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">DN Created</div>
                  <div className="text-sm font-medium text-gray-900">{header.dnCreated}</div>
                </div>
              </div>

              <div className="mt-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">
                          <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} />
                        </th>
                        <th className="text-left font-medium px-4 py-3">Uniq</th>
                        <th className="text-left font-medium px-4 py-3">Material Info</th>
                        <th className="text-left font-medium px-4 py-3">Total Qty</th>
                        <th className="text-left font-medium px-4 py-3">Remaining Qty</th>
                        <th className="text-left font-medium px-4 py-3">UoM</th>
                        <th className="text-left font-medium px-4 py-3">Order Qty</th>
                        <th className="text-left font-medium px-4 py-3">Packing Number</th>
                        <th className="text-left font-medium px-4 py-3">Pcs/Kanban</th>
                        <th className="text-left font-medium px-4 py-3">Date Incoming</th>
                        <th className="text-right font-medium px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((r) => {
                        const checked = selectedKeys.has(r.key);
                        return (
                          <tr key={r.key} className="text-gray-800">
                            <td className="px-4 py-4">
                              <input type="checkbox" checked={checked} onChange={(e) => toggleOne(r.key, e.target.checked)} />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.uniq}</td>
                            <td className="px-4 py-4 min-w-[220px]">
                              <div className="text-[11px] text-gray-500">{r.materialInfo.code}</div>
                              <div className="text-sm font-medium text-gray-900">{r.materialInfo.name}</div>
                              <div className="text-[11px] text-gray-500">{r.materialInfo.model}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.totalQty}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.remainingQty}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.uom}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.orderQty}</td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium">{r.packingNumber}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.pcsPerKanban}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.dateIncoming}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <button type="button" className="inline-flex items-center text-gray-500 hover:text-gray-700" aria-label="QR" onClick={() => openBarcode(r)}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h3v3H7V7zM14 7h3v3h-3V7zM7 14h3v3H7v-3z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 14h1m2 0h0m-3 3h3" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          <Modal
            title={<span className="text-sm font-semibold">DN Item Barcode</span>}
            open={barcodeOpen}
            onCancel={() => {
              setBarcodeOpen(false);
              setBarcodeItem(null);
            }}
            footer={
              <div className="flex items-center justify-end gap-2">
                <Button
                  className="!rounded-lg"
                  onClick={() => {
                    setBarcodeOpen(false);
                    setBarcodeItem(null);
                  }}
                >
                  Close
                </Button>
              </div>
            }
            width={700}
          >
            {barcodeItem ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="text-center">
                  <div className="text-lg font-extrabold tracking-wide text-gray-900">DN ITEM INFORMATION</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {dnNumber} • {barcodeItem.uniq}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] text-gray-500">Material Code</div>
                    <div className="text-sm font-semibold text-gray-900">{barcodeItem.materialInfo.code}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">Material Name</div>
                    <div className="text-sm font-semibold text-gray-900">{barcodeItem.materialInfo.name}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">UoM</div>
                    <div className="text-sm font-semibold text-gray-900">{barcodeItem.uom}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">Order Qty</div>
                    <div className="text-sm font-semibold text-gray-900">{barcodeItem.orderQty}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">Packing Number</div>
                    <div className="text-sm font-semibold text-gray-900">{barcodeItem.packingNumber}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500">Pcs/Kanban</div>
                    <div className="text-sm font-semibold text-gray-900">{barcodeItem.pcsPerKanban}</div>
                  </div>
                </div>

                <div className="my-5 h-px bg-gray-200" />

                <div className="flex items-center justify-center">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <QRCode
                      value={encodeBarcodePayload({
                        v: 1,
                        t: "dnItem",
                        dnNumber,
                        uniq: barcodeItem.uniq,
                        materialInfo: {
                          code: barcodeItem.materialInfo.code,
                          name: barcodeItem.materialInfo.name,
                          model: barcodeItem.materialInfo.model,
                        },
                        totalQty: barcodeItem.totalQty,
                        remainingQty: barcodeItem.remainingQty,
                        uom: barcodeItem.uom,
                        orderQty: barcodeItem.orderQty,
                        packingNumber: barcodeItem.packingNumber,
                        pcsPerKanban: barcodeItem.pcsPerKanban,
                        dateIncoming: barcodeItem.dateIncoming,
                      })}
                      size={200}
                      bordered={false}
                    />
                  </div>
                </div>

                <div className="mt-3 text-center text-sm font-semibold text-gray-900">{barcodeItem.uniq}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No item selected.</div>
            )}
          </Modal>
        </div>
      </div>
    </div>
  );
}
