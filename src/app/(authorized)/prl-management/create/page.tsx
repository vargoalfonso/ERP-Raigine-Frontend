"use client";

import React, { useMemo, useState } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Tag, Upload, message, DatePicker } from "antd";
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useListCustomersQuery } from "@/lib/api/customers/api";
import { useGetBomListQuery, useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useGetGlobalWorkingDaysQuery } from "@/lib/api/system-settings/api";
import {
  useCreatePrlMutation,
  useCreatePrlsBulkMutation,
  useImportPrlsMutation,
} from "@/lib/api/prl/api";

type ForecastEntry = {
  id: string;
  customerUuid?: string;
  customerName?: string;
  forecastPeriod?: string;
  prlType: "additional" | "reguler";
  uniqCode: string[];
  productModel: string;
  partName: string;
  partNumber: string;
  quantity: string; // keep as string for input UX
  quantities: Record<string, string>; // per-uniq quantity when multiple uniqs
  remarks?: string;
};

function normalizeUniqCodes(value?: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function newEntry(seed?: Partial<ForecastEntry>): ForecastEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    customerUuid: seed?.customerUuid,
    customerName: seed?.customerName,
    forecastPeriod: seed?.forecastPeriod,
    prlType: seed?.prlType ?? "reguler",
    uniqCode: normalizeUniqCodes(seed?.uniqCode),
    productModel: seed?.productModel ?? "",
    partName: seed?.partName ?? "",
    partNumber: seed?.partNumber ?? "",
    quantity: seed?.quantity ?? "",
    quantities: seed?.quantities ?? {},
    remarks: seed?.remarks ?? "",
  };
}

function isComplete(entry: ForecastEntry): boolean {
  const hasBase =
    !!entry.customerUuid &&
    !!entry.forecastPeriod &&
    entry.uniqCode.length > 0 &&
    entry.partName.trim().length > 0 &&
    entry.partNumber.trim().length > 0;
  if (!hasBase) return false;

  if (entry.uniqCode.length > 1) {
    return entry.uniqCode.every((code) => {
      const q = Number(entry.quantities?.[code]);
      return Number.isFinite(q) && q > 0;
    });
  }

  const quantityValue = Number(entry.quantity);
  return Number.isFinite(quantityValue) && quantityValue > 0;
}

export default function AddForecastPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ForecastEntry[]>([newEntry()]);
  const [entryMode, setEntryMode] = useState<"manual" | "bulk">("manual");

  const apiEnabled = Boolean(apiBaseUrl);
  const [createPrl, createPrlState] = useCreatePrlMutation();
  const [createPrlsBulk, createPrlsBulkState] = useCreatePrlsBulkMutation();
  const [importPrls, importPrlsState] = useImportPrlsMutation();
  const { data: customers = [] } = useListCustomersQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: bomTreeRes } = useGetBomListQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: globalParameters = [] } = useGetGlobalWorkingDaysQuery(
    undefined,
    {
      skip: !apiEnabled,
    },
  );

  const bomIndex = useMemo(() => {
    const index = buildBomUniqIndex(bomTreeRes?.data ?? []);
    console.log("[PRL Create] bomTreeRes raw:", bomTreeRes);
    console.log("[PRL Create] bomTreeRes?.data (array?):", Array.isArray(bomTreeRes?.data), bomTreeRes?.data);
    console.log("[PRL Create] bomIndex.uniqs:", index.uniqs);
    console.log("[PRL Create] bomIndex.options:", index.options);
    return index;
  }, [bomTreeRes?.data]);

  const uniqOptions = useMemo(() => {
    // Prefer top-level BOM nodes only (parents). If BOM tree is unavailable,
    // fall back to the full uniq list from bomIndex.
    const bomData = bomTreeRes?.data;
    const topNodes: any[] = Array.isArray(bomData)
      ? bomData
      : Array.isArray((bomData as any)?.items)
      ? (bomData as any).items
      : Array.isArray((bomData as any)?.rows)
      ? (bomData as any).rows
      : [];

    if (topNodes.length > 0) {
      const opts = topNodes
        .map((n) => {
          const code = String(n?.uniq ?? n?.uniq_code ?? n?.uniqCode ?? "").trim();
          return code ? { label: code, value: code } : null;
        })
        .filter(Boolean) as { label: string; value: string }[];
      // Ensure uniqueness and stable order
      const map = new Map<string, { label: string; value: string }>();
      for (const it of opts) if (!map.has(it.value)) map.set(it.value, it);
      const res = Array.from(map.values());
      console.log("[PRL Create] uniqOptions (top-level parents):", res);
      return res;
    }

    console.log("[PRL Create] uniqOptions (fallback bomIndex):", bomIndex.options);
    return bomIndex.options;
  }, [bomTreeRes?.data, bomIndex.options]);

  const uniqOptionsForCustomer = (customerId?: string) => {
    if (!customerId) return uniqOptions;
    const cust = customers.find(
      (c) => String(c.id ?? c.customer_id ?? "") === String(customerId),
    );
    const codes = Array.isArray(cust?.bom_codes) ? cust!.bom_codes.map((c: any) => String(c).trim()).filter(Boolean) : [];
    if (codes.length === 0) return [{ label: "belum ada uniq", value: "", disabled: true }];
    const map = new Map(uniqOptions.map((o) => [o.value, o]));
    return codes.map((code) => map.get(code) ?? { label: code, value: code });
  };

  const customerOptions = useMemo(
    () =>
      customers
        .map((customer) => {
          const value = String(
            customer.id ?? customer.customer_id ?? "",
          ).trim();
          const label = String(customer.customer_name ?? "").trim();
          if (!value || !label) return null;
          return { label, value };
        })
        .filter((item): item is { label: string; value: string } =>
          Boolean(item),
        ),
    [customers],
  );

  const periodOptions = useMemo(() => {
    const activePlanningPeriods = globalParameters
      .filter(
        (item) =>
          String(item.status ?? "active")
            .trim()
            .toLowerCase() === "active",
      )
      .filter((item) => {
        const group = String(item.parameter_group ?? "")
          .trim()
          .toLowerCase();
        return group === "planning";
      })
      .map((item) => String(item.period ?? "").trim())
      .filter(Boolean);

    const periods = (
      activePlanningPeriods.length
        ? activePlanningPeriods
        : globalParameters
            .filter(
              (item) =>
                String(item.status ?? "active")
                  .trim()
                  .toLowerCase() === "active",
            )
            .map((item) => String(item.period ?? "").trim())
            .filter(Boolean)
    ).filter((value, index, array) => array.indexOf(value) === index);

    if (periods.length > 0) {
      return periods.map((value) => ({ label: value, value }));
    }

    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1, currentYear + 2];
    return years.flatMap((year) =>
      [1, 2, 3, 4].map((quarter) => ({
        label: `${year}-Q${quarter}`,
        value: `${year}-Q${quarter}`,
      })),
    );
  }, [globalParameters]);

  const completeCount = useMemo(
    () => entries.filter((e) => isComplete(e)).length,
    [entries],
  );

  const updateEntry = (id: string, patch: Partial<ForecastEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  const updateUniqQuantity = (id: string, code: string, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, quantities: { ...e.quantities, [code]: value } }
          : e,
      ),
    );
  };

  const handleCustomerChange = (id: string, customerUuid?: string) => {
    const selected = customerOptions.find(
      (customer) => customer.value === customerUuid,
    );
    updateEntry(id, {
      customerUuid,
      customerName: selected?.label ?? "",
    });
  };

  const handleUniqChange = (id: string, uniqCode?: string[]) => {
    const nextUniq = normalizeUniqCodes(uniqCode);
    const collectByUniq = (lookup: Record<string, string>) =>
      nextUniq.map((code) => lookup[code] ?? "").filter(Boolean).join(", ");
    const partName = collectByUniq(bomIndex.partNameByUniq);
    const partNumber = collectByUniq(bomIndex.partNumberByUniq);
    const productModel = nextUniq
      .map(
        (code) =>
          bomIndex.modelByUniq[code] ?? bomIndex.assemblyCodeByUniq[code] ?? "",
      )
      .filter(Boolean)
      .join(", ");

    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const nextQuantities: Record<string, string> = {};
        for (const code of nextUniq) {
          nextQuantities[code] = e.quantities?.[code] ?? "";
        }
        return {
          ...e,
          uniqCode: nextUniq,
          productModel,
          partName,
          partNumber,
          quantities: nextQuantities,
        };
      }),
    );
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, newEntry()]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) =>
      prev.length > 1 ? prev.filter((entry) => entry.id !== id) : prev,
    );
  };

  const saveAll = async () => {
    if (completeCount !== entries.length) {
      message.error("Please complete all PRL entries before saving");
      return;
    }

    if (!apiEnabled) {
      message.success(
        `Saved ${entries.length} PRL entr${entries.length > 1 ? "ies" : "y"}`,
      );
      router.push("/prl-management");
      return;
    }

    try {
      // A single-uniq entry becomes one standalone PRL (its own prl_id).
      // A multi-uniq entry is sent as ONE bulk group ({ entries: [...] }) so the
      // backend creates a single shared prl_id, with each uniq stored as a
      // detail row that keeps its own quantity.
      const singlePayloads: any[] = [];
      const groupPayloads: { entries: any[] }[] = [];

      for (const entry of entries) {
        const codes = entry.uniqCode;
        const customer_uuid = String(entry.customerUuid ?? "").trim();
        const forecast_period = String(entry.forecastPeriod ?? "");
        const remarks = String(entry.remarks ?? "").trim();

        if (codes.length > 1) {
          const entriesPayload = codes.map((code) => {
            const productModel =
              bomIndex.modelByUniq[code] ??
              bomIndex.assemblyCodeByUniq[code] ??
              entry.productModel;
            const detail: any = {
              customer_uuid,
              uniq_code: code,
              product_model: String(productModel ?? "").trim(),
              part_name: String(bomIndex.partNameByUniq[code] ?? "").trim(),
              part_number: String(bomIndex.partNumberByUniq[code] ?? "").trim(),
              forecast_period,
              quantity: Number(entry.quantities?.[code] ?? 0),
              prl_type: entry.prlType,
            };
            if (remarks) detail.remarks = remarks;
            return detail;
          });
          groupPayloads.push({ entries: entriesPayload });
        } else {
          const payload: any = {
            customer_uuid,
            uniq_code: entry.uniqCode,
            product_model: entry.productModel.trim(),
            part_name: entry.partName.trim(),
            part_number: entry.partNumber.trim(),
            forecast_period,
            quantity: Number(entry.quantity),
            prl_type: entry.prlType,
          };
          if (remarks) payload.remarks = remarks;
          singlePayloads.push(payload);
        }
      }

      await Promise.all([
        ...singlePayloads.map((payload) => createPrl(payload as any).unwrap()),
        ...groupPayloads.map((payload) =>
          createPrlsBulk(payload as any).unwrap(),
        ),
      ]);

      // Each group counts as a single PRL id.
      const totalCount = singlePayloads.length + groupPayloads.length;
      message.success(
        `Saved ${totalCount} PRL entr${totalCount > 1 ? "ies" : "y"}`,
      );
      router.push("/prl-management");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save PRL data"));
    }
  };

  const handleUploadExcel = async (file: File) => {
    const isExcel =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls");

    if (!isExcel) {
      message.error("Please upload an Excel file (.xlsx/.xls)");
      return Upload.LIST_IGNORE;
    }

    if (!apiEnabled) {
      message.success(`Imported ${file.name}`);
      return false;
    }

    try {
      await importPrls(file).unwrap();
      message.success(`Imported ${file.name}`);
      router.push("/prl-management");
    } catch (err) {
      message.error(getApiErrorMessage(err, "PRL import failed"));
    }

    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/prl-management"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
              <ArrowLeftOutlined />
              Back to PRL Management
            </Link>
            <div className="mt-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {entryMode === "manual"
                  ? "Add PRL Forecast"
                  : "Import PRL Forecast"}
              </h1>
              <div className="text-sm text-gray-500">
                {entryMode === "manual" ? (
                  <>
                    Create PRL forecasts using customer and BOM data{" "}
                    <span className="mx-2">•</span> {entries.length} entr
                    {entries.length > 1 ? "ies" : "y"}
                  </>
                ) : (
                  <>
                    Upload Excel forecast file through{" "}
                    <span className="mx-2">•</span> /import/prls
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => router.push("/prl-management")}>
              Cancel
            </Button>
            {entryMode === "manual" ? (
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<SaveOutlined />}
                onClick={saveAll}
                loading={
                  createPrlState.isLoading || createPrlsBulkState.isLoading
                }>
                Save PRL
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="inline-flex rounded-lg bg-gray-50 p-1 border border-gray-100">
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={
                "px-4 py-2 text-sm font-medium rounded-md transition-colors " +
                (entryMode === "manual"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900")
              }>
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("bulk")}
              className={
                "px-4 py-2 text-sm font-medium rounded-md transition-colors " +
                (entryMode === "bulk"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900")
              }>
              Bulk Operation
            </button>
          </div>
        </div>

        {entryMode === "bulk" ? (
          <div className="space-y-6">
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
              <div className="flex items-start gap-3">
                <FileExcelOutlined className="mt-0.5 text-blue-700" />
                <div>
                  <div className="text-sm font-semibold text-blue-800">
                    Bulk PRL Import
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Use Excel upload for bulk operation. File will be sent to
                    `POST /import/prls`.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="text-base font-semibold text-gray-900">
                Upload Excel File
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Upload PRL data in one go using the backend import endpoint.
              </div>

              <div className="mt-4">
                <Upload.Dragger
                  name="file"
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={(file) => handleUploadExcel(file as File)}
                  disabled={importPrlsState.isLoading}>
                  <div className="py-8">
                    <UploadOutlined className="text-3xl text-gray-400 mb-3" />
                    <div className="text-sm font-semibold text-gray-900">
                      Upload PRL Excel File
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Drag and drop your Excel file here, or click to browse.
                    </div>
                    <Button
                      className="!rounded-lg mt-4"
                      type="primary"
                      loading={importPrlsState.isLoading}>
                      Choose File
                    </Button>
                  </div>
                </Upload.Dragger>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Info card */}
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-blue-700">↗</div>
                <div>
                  <div className="text-sm font-semibold text-blue-800">
                    PRL Entry Rules
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Customer comes from Master Customer, UNIQ comes from BOM,
                    and part name, part number, plus product model are
                    auto-filled from BOM data.
                  </div>
                </div>
              </div>
            </div>

            {/* Entry cards */}
            <div className="space-y-6">
              {entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <div className="text-base font-semibold text-gray-900">
                        PRL Entry #{idx + 1}
                      </div>
                      <div className="text-sm text-gray-500">
                        Configure forecast details for production planning
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="!rounded-lg !px-3 !py-1" color="default">
                        Entry {idx + 1}
                      </Tag>
                      {entries.length > 1 ? (
                        <Button
                          danger
                          className="!rounded-lg"
                          onClick={() => removeEntry(entry.id)}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Customer Name
                      </div>
                      <Select
                        value={entry.customerUuid}
                        onChange={(value) =>
                          handleCustomerChange(entry.id, value)
                        }
                        options={customerOptions}
                        placeholder="Select customer"
                        className="w-full"
                        showSearch
                        allowClear
                        filterOption={(input, option) =>
                          String(option?.label ?? "")
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Forecast Period
                      </div>
                      <DatePicker
                        picker="month"
                        value={
                          entry.forecastPeriod
                            ? dayjs(entry.forecastPeriod, "MMMM-YYYY")
                            : undefined
                        }
                        onChange={(date) =>
                          updateEntry(entry.id, {
                            forecastPeriod: date
                              ? dayjs(date).format("MMMM-YYYY")
                              : "",
                          })
                        }
                        className="w-full"
                        format={(value) =>
                          value ? dayjs(value).format("MMMM-YYYY") : ""
                        }
                        allowClear
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        PRL Type
                      </div>
                      <Select
                        value={entry.prlType}
                        onChange={(value) =>
                          updateEntry(entry.id, {
                            prlType: value as "additional" | "reguler",
                          })
                        }
                        options={[
                          { value: "reguler", label: "Reguler" },
                          { value: "additional", label: "Additional" },
                        ]}
                        placeholder="Select PRL type"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        UNIQ Code
                      </div>
                      <Select
                        mode="multiple"
                        value={entry.uniqCode}
                        onChange={(value) => handleUniqChange(entry.id, value)}
                        options={uniqOptionsForCustomer(entry.customerUuid)}
                        placeholder="Select one or more UNIQ from BOM"
                        className="w-full"
                        showSearch
                        allowClear
                        maxTagCount="responsive"
                        filterOption={(input, option) =>
                          String(option?.label ?? "")
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Product Model
                      </div>
                      <Input
                        value={entry.productModel}
                        placeholder="Auto-filled from BOM model"
                        className="!rounded-lg"
                        readOnly
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Part Name
                      </div>
                      <Input
                        value={entry.partName}
                        placeholder="Auto-filled from uniq"
                        className="!rounded-lg"
                        readOnly
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Part Number
                      </div>
                      <Input
                        value={entry.partNumber}
                        placeholder="Auto-filled from uniq"
                        className="!rounded-lg"
                        readOnly
                      />
                    </div>

                    {entry.uniqCode.length > 1 ? (
                      <div className="lg:col-span-2">
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                          Quantity per UNIQ
                        </div>
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 font-semibold text-gray-600">
                                  UNIQ Code
                                </th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-600 w-52">
                                  Quantity
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.uniqCode.map((code) => (
                                <tr
                                  key={code}
                                  className="border-t border-gray-100">
                                  <td className="px-3 py-2 font-medium text-gray-700">
                                    {code}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      value={entry.quantities?.[code] ?? ""}
                                      onChange={(e) =>
                                        updateUniqQuantity(
                                          entry.id,
                                          code,
                                          e.target.value.replace(/[^0-9]/g, ""),
                                        )
                                      }
                                      placeholder="e.g., 2500"
                                      className="!rounded-lg"
                                      inputMode="numeric"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                          Quantity
                        </div>
                        <Input
                          value={entry.quantity}
                          onChange={(e) =>
                            updateEntry(entry.id, {
                              quantity: e.target.value.replace(/[^0-9]/g, ""),
                            })
                          }
                          placeholder="e.g., 2500"
                          className="!rounded-lg"
                          inputMode="numeric"
                        />
                      </div>
                    )}

                    <div className="lg:col-span-2">
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Remarks (optional)
                      </div>
                      <Input
                        value={entry.remarks}
                        onChange={(e) =>
                          updateEntry(entry.id, { remarks: e.target.value })
                        }
                        placeholder="Optional remarks or note"
                        className="!rounded-lg"
                      />
                    </div>

                    <div className="flex items-end">
                      <div className="text-xs text-gray-500">
                        {isComplete(entry) ? (
                          <span className="text-green-700 font-semibold">
                            Ready to save
                          </span>
                        ) : (
                          <span>Fill all fields to mark complete</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-center">
                <Button
                  className="!rounded-lg"
                  icon={<PlusOutlined />}
                  onClick={addAnother}>
                  Add Another PRL Entry
                </Button>
              </div>

              {/* Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Summary
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {completeCount} PRL entr{completeCount === 1 ? "y" : "ies"}{" "}
                    ready to be saved
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {entries.length}
                    </div>
                    <div className="text-xs text-gray-500">Entries</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {completeCount}
                    </div>
                    <div className="text-xs text-gray-500">Complete</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
