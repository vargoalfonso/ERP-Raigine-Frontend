"use client";

import { Table, Input } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { debounce } from "lodash";
import type { ReactNode } from "react";
import React, { useState, useMemo } from "react";

type SortOrder = "ascend" | "descend" | null;

export type TableColumn<T> = {
  title: React.ReactNode;
  dataIndex?: keyof T;
  fixed?: boolean;
  key?: string;
  render?: (value: unknown, record: T) => React.ReactNode;
  width?: number;
  children?: TableColumn<T>[];
};

interface TableTemplateProps<T extends object> {
  key?: string;
  columns: (ColumnType<T> & { sortFieldKey?: string })[];
  size?: "small" | "middle" | "large";
  data: T[];
  rowKey?: string | keyof T | ((record: T) => React.Key);
  searchValue?: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
  pageSize: number;
  currentPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortField?: string;
  sortOrder?: SortOrder;
  onSortChange?: (field: string, order: SortOrder) => void;
  hideSearch?: boolean;
  loading?: boolean;
  filters?: ReactNode;
  rowSelection?: {
    selectedRowKeys?: React.Key[];
    onChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
    onSelect?: (
      record: T,
      selected: boolean,
      selectedRows: T[],
      nativeEvent: Event
    ) => void;
    onSelectAll?: (
      selected: boolean,
      selectedRows: T[],
      changeRows: T[]
    ) => void;
  };
}

export default function TableTemplate<T extends object>({
  columns,
  data,
  rowKey = "key",
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  actions,
  pageSize,
  currentPage,
  total,
  onPageChange,
  onPageSizeChange,
  sortField,
  sortOrder,
  onSortChange,
  hideSearch = false,
  loading = false,
  size = "middle",
  filters,
  rowSelection,
}: TableTemplateProps<T>) {
  const processedColumns: ColumnsType<T> = columns.map((col) => {
    if (onSortChange) {
      const sortKey = col.sortFieldKey ?? col.dataIndex?.toString();
      return {
        ...col,
        sorter: true,
        sortOrder: sortField === sortKey ? sortOrder : null,
      };
    }
    return col;
  });

  const [searchData, setSearchData] = useState(searchValue || "");

  const handleSearchDebounce = useMemo(
    () =>
      debounce((val: string) => {
        onSearchChange(val);
      }, 400),
    [onSearchChange]
  );

  return (
    <div className="space-y-4">
      {!hideSearch && (
        <div className="md:flex items-center justify-between mb-4">
          <div
            className={`md:flex  items-end ${
              filters ? " w-full md:max-w-[30%] space-x-4" : ""
            }`}
          >
            {filters && <div className="w-full">{filters}</div>}
            {!filters && (
              <Input.Search
                placeholder={searchPlaceholder}
                allowClear
                value={searchData}
                onChange={(e) => {
                  handleSearchDebounce(e.target.value);
                  setSearchData(e.target.value);
                }}
                style={{ width: 300 }}
              />
            )}
          </div>

          <div className={`${filters ? "md:flex items-center gap-2" : ""}`}>
            {filters && (
              <Input.Search
                placeholder={searchPlaceholder}
                allowClear
                value={searchData}
                onChange={(e) => {
                  handleSearchDebounce(e.target.value);
                  setSearchData(e.target.value);
                }}
                style={{ width: 300 }}
              />
            )}
            <div>{actions}</div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table<T>
          columns={processedColumns}
          key={"data_" + (typeof rowKey === "string" ? rowKey : "row")}
          size={size}
          dataSource={data}
          rowKey={rowKey}
          bordered
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            pageSize,
            current: currentPage,
            total,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
            onChange: (page, newPageSize) => {
              if (page !== currentPage) onPageChange(page);
              if (newPageSize !== pageSize) onPageSizeChange(newPageSize);
            },
            showQuickJumper: true,
            pageSizeOptions: ["5", "10", "20", "50", "100"],
            showSizeChanger: true,
          }}
          scroll={{ x: "max-content" }}
          onChange={(
            pagination,
            filters,
            sorter: SorterResult<T> | SorterResult<T>[]
          ) => {
            if (onSortChange && !Array.isArray(sorter) && sorter?.field) {
              const clickedCol = columns.find(
                (col) => col.dataIndex === sorter.field
              );
              const sortKey =
                clickedCol?.sortFieldKey ?? sorter.field?.toString();
              const order = sorter.order as SortOrder;
              onSortChange(sortKey, order);
            }
          }}
        />
      </div>
    </div>
  );
}
