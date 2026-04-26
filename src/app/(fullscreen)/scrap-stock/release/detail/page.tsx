"use client";

import React, { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Tag } from "antd";
import dayjs from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetScrapReleaseByIdQuery } from "@/lib/api/scrap-release/api";
import { useGetScrapStockByIdQuery } from "@/lib/api/scrap-stock/api";

function ScrapReleaseDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const apiEnabled = Boolean(apiBaseUrl);

  const releaseQuery = useGetScrapReleaseByIdQuery(String(id), {
    skip: !apiEnabled || !id,
  });

  const release = releaseQuery.data;

  const scrapStockQuery = useGetScrapStockByIdQuery(String(release?.scrap_stock_id ?? ""), {
    skip: !apiEnabled || !release?.scrap_stock_id,
  });

  const scrapStock = useMemo(() => scrapStockQuery.data ?? null, [scrapStockQuery.data]);

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined className="cursor-pointer" onClick={() => router.back()} />
          <h1 className="text-2xl font-semibold m-0">Scrap Release Detail</h1>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow">
          {releaseQuery.isFetching ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : !release ? (
            <div className="text-sm text-gray-500">No data.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400">Release Number</p>
                  <p className="font-semibold">{release.release_number || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-400">Release Date</p>
                  <p className="font-semibold">
                    {release.release_date ? dayjs(release.release_date).format("YYYY-MM-DD") : "-"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">Type</p>
                  <Tag>{release.release_type || "-"}</Tag>
                </div>

                <div>
                  <p className="text-gray-400">Qty Released</p>
                  <p className="font-semibold">{release.release_qty ?? 0}</p>
                </div>

                <div>
                  <p className="text-gray-400">Weight Released (kg)</p>
                  <p className="font-semibold">{release.weight_released ?? "-"}</p>
                </div>

                <div>
                  <p className="text-gray-400">Buyer / Customer</p>
                  <p className="font-semibold">{release.customer_name || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-400">Price / Unit</p>
                  <p className="font-semibold">{release.price_per_unit ?? "-"}</p>
                </div>

                <div>
                  <p className="text-gray-400">Total Value</p>
                  <p className="font-semibold">{release.total_value ?? "-"}</p>
                </div>

                <div>
                  <p className="text-gray-400">Disposal Reason</p>
                  <Tag>{release.disposal_reason ?? "-"}</Tag>
                </div>

                <div>
                  <p className="text-gray-400">Approval Status</p>
                  <Tag>{release.approval_status || "-"}</Tag>
                </div>

                <div>
                  <p className="text-gray-400">Validator</p>
                  <p className="font-semibold">{release.validator || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-400">Remarks</p>
                  <p className="font-semibold">{release.remarks || "-"}</p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <div className="font-semibold text-gray-900 mb-2">Scrap Stock</div>
                {scrapStockQuery.isFetching ? (
                  <div className="text-sm text-gray-500">Loading scrap stock…</div>
                ) : !scrapStock ? (
                  <div className="text-sm text-gray-500">Scrap stock id: {release.scrap_stock_id}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">UNIQ</div>
                      <div className="font-semibold">{scrapStock.uniq}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Part Name</div>
                      <div className="font-semibold">{scrapStock.part_name}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Part Number</div>
                      <div className="font-semibold">{scrapStock.part_number}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Model</div>
                      <div className="font-semibold">{scrapStock.model}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Packing Number</div>
                      <div className="font-semibold">{scrapStock.packing_number}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Status</div>
                      <div className="font-semibold">{scrapStock.status}</div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Button onClick={() => router.push(`/scrap-stock/detail?id=${encodeURIComponent(String(release.scrap_stock_id))}`)}>
                    View Scrap Stock
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button onClick={() => router.push("/scrap-stock")}>Back to Scrap Stock</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ScrapReleaseDetailPage() {
  return (
    <Suspense fallback={null}>
      <ScrapReleaseDetailContent />
    </Suspense>
  );
}
