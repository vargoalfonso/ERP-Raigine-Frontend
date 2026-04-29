"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useCreateScrapTypeMutation,
  useGetScrapTypeByIdQuery,
  useGetScrapTypesQuery,
  useUpdateScrapTypeMutation,
} from "@/lib/api/scrap-types/api";

type StatusType = "Active" | "Inactive";
type PageMode = "create" | "edit" | "detail";

type ScrapTypeEntry = {
  id: string;
  typeCode?: string;
  typeName?: string;
  description?: string;
  status?: StatusType;
  created?: boolean;
};

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

const fromBackendStatus = (value: unknown): StatusType => {
  const lowered = String(value ?? "active").trim().toLowerCase();
  return lowered.includes("inact") ? "Inactive" : "Active";
};

const toBackendStatus = (value: StatusType) =>
  value === "Inactive" ? "Inactive" : "Active";

function nextScrCode(existing: ScrapTypeEntry[]) {
  const nums = existing
    .map((d) => d.typeCode)
    .filter((c): c is string => Boolean(c))
    .map((code) => {
      const m = code.match(/(\d+)$/);
      return m ? Number(m[1]) : null;
    })
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SCR-${String(next).padStart(3, "0")}`;
}

function makeEntry(idx: number, existing: ScrapTypeEntry[]) {
  return {
    id: `entry-${idx}`,
    typeCode: nextScrCode(existing),
    typeName: undefined,
    description: undefined,
    status: "Active" as StatusType,
    created: false,
  } satisfies ScrapTypeEntry;
}

function ScrapTypeCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiEnabled = Boolean(apiBaseUrl);
  const [messageApi, contextHolder] = message.useMessage();

  const rawMode = String(searchParams.get("mode") ?? "create").trim().toLowerCase();
  const mode: PageMode = rawMode === "edit" || rawMode === "detail" ? (rawMode as PageMode) : "create";
  const isReadOnly = mode === "detail";
  const itemId = String(searchParams.get("id") ?? "").trim();

  const { data: scrapListData } = useGetScrapTypesQuery({ page: 1, limit: 100 }, { skip: !apiEnabled });
  const detailQuery = useGetScrapTypeByIdQuery(itemId, {
    skip: !apiEnabled || mode === "create" || !itemId,
  });
  const [createScrapType, createState] = useCreateScrapTypeMutation();
  const [updateScrapType, updateState] = useUpdateScrapTypeMutation();

  const initialEntries = useMemo<ScrapTypeEntry[]>(() => {
    const existing = (scrapListData?.items ?? []).map((item) => ({
      id: String(item.id),
      typeCode: item.code,
      typeName: item.name,
      description: item.description,
      status: fromBackendStatus(item.status),
      created: true,
    }));
    return [makeEntry(1, existing)];
  }, [scrapListData?.items]);

  const [entries, setEntries] = useState<ScrapTypeEntry[]>(initialEntries);

  useEffect(() => {
    if (mode !== "create") return;
    setEntries((prev) => {
      if (prev.length > 0 && prev[0]?.typeCode) return prev;
      return initialEntries;
    });
  }, [initialEntries, mode]);

  useEffect(() => {
    if (!detailQuery.data || mode === "create") return;
    setEntries([
      {
        id: String(detailQuery.data.id),
        typeCode: detailQuery.data.code,
        typeName: detailQuery.data.name,
        description: detailQuery.data.description,
        status: fromBackendStatus(detailQuery.data.status),
        created: true,
      },
    ]);
  }, [detailQuery.data, mode]);

  const completeCount = useMemo(
    () => entries.filter((entry) => Boolean(entry.typeCode && entry.typeName && entry.description && entry.status)).length,
    [entries],
  );

  const updateEntry = (id: string, patch: Partial<ScrapTypeEntry>) => {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch, created: false } : entry)));
  };

  const validateEntry = (entry: ScrapTypeEntry) => {
    if (!entry.typeCode) return "Type Code is required";
    if (!entry.typeName) return "Type Name is required";
    if (!entry.description) return "Description is required";
    if (!entry.status) return "Status is required";
    return null;
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1, prev)]);
  };

  const goBack = () => router.push("/system-settings");

  const onSave = async () => {
    if (isReadOnly) {
      goBack();
      return;
    }

    for (const entry of entries) {
      const err = validateEntry(entry);
      if (err) {
        messageApi.error(`Entry ${entries.indexOf(entry) + 1}: ${err}`);
        return;
      }
    }

    if (!apiEnabled) {
      messageApi.warning("Set NEXT_PUBLIC_API_URL before saving scrap types.");
      return;
    }

    try {
      if (mode === "edit") {
        const entry = entries[0];
        if (!itemId) {
          messageApi.error("Missing scrap type id");
          return;
        }

        await updateScrapType({
          id: itemId,
          body: {
            name: String(entry.typeName ?? "").trim(),
            description: String(entry.description ?? "").trim(),
            status: toBackendStatus(entry.status ?? "Active"),
          },
        }).unwrap();

        messageApi.success("Scrap type updated");
        goBack();
        return;
      }

      for (const entry of entries) {
        await createScrapType({
          name: String(entry.typeName ?? "").trim(),
          description: String(entry.description ?? "").trim(),
          status: toBackendStatus(entry.status ?? "Active"),
        }).unwrap();
      }

      messageApi.success("Scrap type saved");
      goBack();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, "Failed to save scrap type"));
    }
  };

  const pageTitle =
    mode === "detail" ? "Scrap Type Detail" : mode === "edit" ? "Edit Scrap Type" : "Add Scrap Type";
  const pageSubtitle =
    mode === "detail"
      ? "View Scrap Type"
      : mode === "edit"
        ? "Update Scrap Type"
        : `Create Scrap Type • ${entries.length} entry`;

  const saveLoading = createState.isLoading || updateState.isLoading;

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      {contextHolder}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" onClick={goBack}>
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <div>
              <div className="text-xl font-semibold text-gray-900">{pageTitle}</div>
              <div className="text-sm text-gray-500">{pageSubtitle}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={goBack}>{isReadOnly ? "Back" : "Cancel"}</Button>
            {!isReadOnly ? (
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saveLoading}>
                {mode === "edit" ? "Save Changes" : "Save Parameter"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {entries.map((entry, idx) => (
            <Card key={entry.id} className="rounded-2xl" styles={{ body: { padding: 24 } }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    {mode === "detail" ? `Scrap Type #${idx + 1}` : `Add New Parameter #${idx + 1}`}
                  </div>
                  <div className="text-sm text-gray-500">Configure Parameter for Scrap Types</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Entry {idx + 1}</Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Type Code</div>
                  <Input value={entry.typeCode} placeholder="auto-generated" disabled />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Type Name</div>
                  <Input
                    value={entry.typeName}
                    onChange={(ev) => updateEntry(entry.id, { typeName: ev.target.value })}
                    placeholder="Incoming QC Scrap"
                    disabled={isReadOnly}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Description</div>
                  <Input
                    value={entry.description}
                    onChange={(ev) => updateEntry(entry.id, { description: ev.target.value })}
                    placeholder="Scrap from incoming QC inspection"
                    disabled={isReadOnly}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Status</div>
                  <Select
                    value={entry.status}
                    onChange={(value) => updateEntry(entry.id, { status: value as StatusType })}
                    placeholder="Select Status"
                    options={STATUS_OPTIONS as unknown as { label: string; value: string }[]}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </Card>
          ))}

          {mode === "create" ? (
            <div className="flex items-center justify-center">
              <Button icon={<PlusOutlined />} onClick={addAnother}>Add Another Parameter</Button>
            </div>
          ) : null}

          <Card className="rounded-2xl" styles={{ body: { padding: 18 } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">Summary</div>
                <div className="text-sm text-gray-500">{entries.length} Parameter ready to be saved</div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{entries.length}</div>
                  <div className="text-xs text-gray-500">Entries</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{completeCount}</div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ScrapTypeCreatePage() {
  return (
    <Suspense fallback={null}>
      <ScrapTypeCreatePageContent />
    </Suspense>
  );
}
