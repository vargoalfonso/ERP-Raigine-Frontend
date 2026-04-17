"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  type SupplierRecord,
  useDeleteSupplierMutation,
  useGetSupplierByIdQuery,
  useListSuppliersQuery,
} from "@/lib/api/suppliers/api";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";

type SupplierOnlyRow = {
  key: string;
  id?: string;
  supplierCode: string;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  materialCategory: string;
  city: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: string;
  fullAddress: string;
};

const toSupplierOnlyRow = (record: SupplierRecord, index: number): SupplierOnlyRow => ({
  key: String(record.id ?? record.supplier_code ?? index),
  id: record.id == null ? undefined : String(record.id),
  supplierCode: String(record.supplier_code ?? "-"),
  supplierName: String(record.supplier_name ?? "-"),
  contactPerson: String(record.contact_person ?? "-"),
  contactNumber: String(record.contact_number ?? "-"),
  emailAddress: String(record.email_address ?? "-"),
  materialCategory: String(record.material_category ?? "-"),
  city: String(record.city ?? "-"),
  paymentTerms: String(record.payment_terms ?? "-"),
  leadTimeDays: Number(record.delivery_lead_time_days ?? 0),
  status: String(record.status ?? "Active"),
  fullAddress: String(record.full_address ?? "-"),
});

export default function MasterSupplierOnlyPage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);
  const { data: supplierList = [], refetch } = useListSuppliersQuery(undefined, {
    skip: !apiEnabled,
  });
  const [deleteSupplier, deleteState] = useDeleteSupplierMutation();
  const [searchValue, setSearchValue] = useState("");
  const [selectedRow, setSelectedRow] = useState<SupplierOnlyRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedId = selectedRow?.id;
  const supplierDetailQuery = useGetSupplierByIdQuery(selectedId ?? "", {
    skip: !apiEnabled || !detailOpen || !selectedId,
  });

  const rows = useMemo(
    () => supplierList.map((record, index) => toSupplierOnlyRow(record, index)),
    [supplierList]
  );

  const filteredRows = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.supplierCode,
        row.supplierName,
        row.contactPerson,
        row.contactNumber,
        row.emailAddress,
        row.materialCategory,
        row.city,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, searchValue]);

  const columns: ColumnsType<SupplierOnlyRow> = [
    {
      title: "Supplier Code",
      dataIndex: "supplierCode",
      key: "supplierCode",
      width: 140,
      render: (value: string) => (
        <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
          {value}
        </span>
      ),
    },
    {
      title: "Supplier Name",
      dataIndex: "supplierName",
      key: "supplierName",
      width: 220,
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    {
      title: "Contact",
      key: "contact",
      width: 220,
      render: (_value, row) => (
        <div className="text-sm text-gray-700">
          <div>{row.contactPerson}</div>
          <div className="text-xs text-gray-500">{row.contactNumber}</div>
        </div>
      ),
    },
    {
      title: "Email",
      dataIndex: "emailAddress",
      key: "emailAddress",
      width: 220,
      render: (value: string) => <span className="text-gray-700">{value}</span>,
    },
    {
      title: "Category",
      dataIndex: "materialCategory",
      key: "materialCategory",
      width: 180,
      render: (value: string) => <span className="text-gray-700">{value}</span>,
    },
    {
      title: "Lead Time",
      dataIndex: "leadTimeDays",
      key: "leadTimeDays",
      width: 120,
      render: (value: number) => <span className="text-gray-700">{value} days</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (value: string) => {
        const v = String(value ?? "").toLowerCase();
        const isActive = v === "active" || v === "1" || v === "true";
        return <Tag color={isActive ? "green" : "default"}>{value}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRow(row);
              setDetailOpen(true);
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              if (!row.id) {
                message.error("Missing supplier id");
                return;
              }
              router.push(`/master-supplier/only/${encodeURIComponent(String(row.id))}/edit`);
            }}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              setSelectedRow(row);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Supplier Only</h1>
          <p className="text-gray-600">Supplier directory khusus supplier-only, terpisah dari mapping raw, indirect, dan subcon.</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push("/master-supplier/only/create")}
          className="!rounded-lg"
        >
          Add Supplier Only
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Input
            allowClear
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search supplier name, code, contact..."
            prefix={<SearchOutlined />}
            className="w-full md:w-[360px]"
          />
          <div className="text-xs text-gray-500">{filteredRows.length} suppliers</div>
        </div>

        <Table<SupplierOnlyRow>
          columns={columns}
          dataSource={filteredRows}
          rowKey="key"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </div>

      <Modal
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedRow(null);
        }}
        footer={
          <Button
            className="!rounded-lg"
            onClick={() => {
              setDetailOpen(false);
              setSelectedRow(null);
            }}
          >
            Close
          </Button>
        }
        title="Supplier Only Detail"
      >
        {selectedRow ? (
          supplierDetailQuery.isFetching ? (
            <div className="text-sm text-gray-500">Loading detail...</div>
          ) : supplierDetailQuery.isError ? (
            <div className="text-sm text-red-600">
              {getApiErrorMessage(supplierDetailQuery.error, "Failed to load supplier detail")}
            </div>
          ) : (
            (() => {
              const d = supplierDetailQuery.data;
              const supplierCode = String(d?.supplier_code ?? selectedRow.supplierCode ?? "-");
              const supplierName = String(d?.supplier_name ?? selectedRow.supplierName ?? "-");
              const contactPerson = String(d?.contact_person ?? selectedRow.contactPerson ?? "-");
              const contactNumber = String(d?.contact_number ?? selectedRow.contactNumber ?? "-");
              const emailAddress = String(d?.email_address ?? selectedRow.emailAddress ?? "-");
              const materialCategory = String(d?.material_category ?? selectedRow.materialCategory ?? "-");
              const paymentTerms = String(d?.payment_terms ?? selectedRow.paymentTerms ?? "-");
              const leadTimeDays = Number(d?.delivery_lead_time_days ?? selectedRow.leadTimeDays ?? 0);
              const fullAddress = String(d?.full_address ?? selectedRow.fullAddress ?? "-");
              const city = String(d?.city ?? "-");
              const province = String(d?.province ?? "-");
              const country = String(d?.country ?? "-");
              const taxId = String(d?.tax_id_npwp ?? "-");
              const bankName = String(d?.bank_name ?? "-");
              const bankAccountNumber = String(d?.bank_account_number ?? "-");
              const bankAccountName = String(d?.bank_account_name ?? "-");

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><div className="text-gray-500">Supplier Code</div><div className="font-semibold text-gray-900">{supplierCode}</div></div>
                  <div><div className="text-gray-500">Supplier Name</div><div className="font-semibold text-gray-900">{supplierName}</div></div>
                  <div><div className="text-gray-500">Contact Person</div><div className="text-gray-900">{contactPerson}</div></div>
                  <div><div className="text-gray-500">Contact Number</div><div className="text-gray-900">{contactNumber}</div></div>
                  <div><div className="text-gray-500">Email</div><div className="text-gray-900">{emailAddress}</div></div>
                  <div><div className="text-gray-500">Category</div><div className="text-gray-900">{materialCategory}</div></div>
                  <div><div className="text-gray-500">Payment Terms</div><div className="text-gray-900">{paymentTerms}</div></div>
                  <div><div className="text-gray-500">Lead Time</div><div className="text-gray-900">{leadTimeDays} days</div></div>
                  <div><div className="text-gray-500">City</div><div className="text-gray-900">{city}</div></div>
                  <div><div className="text-gray-500">Province</div><div className="text-gray-900">{province}</div></div>
                  <div><div className="text-gray-500">Country</div><div className="text-gray-900">{country}</div></div>
                  <div><div className="text-gray-500">NPWP</div><div className="text-gray-900">{taxId}</div></div>
                  <div><div className="text-gray-500">Bank</div><div className="text-gray-900">{bankName}</div></div>
                  <div><div className="text-gray-500">Bank Account No</div><div className="text-gray-900">{bankAccountNumber}</div></div>
                  <div><div className="text-gray-500">Bank Account Name</div><div className="text-gray-900">{bankAccountName}</div></div>
                  <div className="md:col-span-2"><div className="text-gray-500">Address</div><div className="text-gray-900">{fullAddress}</div></div>
                </div>
              );
            })()
          )
        ) : null}
      </Modal>

      <Modal
        open={deleteOpen}
        onCancel={() => {
          setDeleteOpen(false);
          setSelectedRow(null);
        }}
        okText="Delete"
        okButtonProps={{ danger: true, className: "!rounded-lg", loading: deleteState.isLoading }}
        cancelButtonProps={{ className: "!rounded-lg" }}
        onOk={async () => {
          try {
            if (!selectedRow?.id) throw new Error("Missing supplier id");
            await deleteSupplier(selectedRow.id).unwrap();
            message.success("Supplier deleted");
            setDeleteOpen(false);
            setSelectedRow(null);
            refetch();
          } catch (error) {
            message.error(getApiErrorMessage(error, "Failed to delete supplier"));
          }
        }}
        title="Delete supplier?"
      >
        <div>Delete <span className="font-semibold">{selectedRow?.supplierName}</span> from Supplier Only?</div>
      </Modal>
    </div>
  );
}