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
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type CustomerRecord,
  useDeleteCustomerMutation,
  useGetCustomerByIdQuery,
  useListCustomersQuery,
} from "@/lib/api/customers/api";

type CustomerRow = {
  key: string;
  id?: string;
  customerId: string;
  customerName: string;
  phoneNumber: string;
  shippingAddress: string;
  bankAccount: string;
  bankAccountNumber: string;
  status: string;
};

const toCustomerRow = (record: CustomerRecord, index: number): CustomerRow => {
  const id = record.id ?? record.customer_id ?? record.customer_code ?? index;
  return {
    key: String(id),
    id: record.id == null ? undefined : String(record.id),
    customerId: String(record.customer_id ?? record.customer_code ?? record.id ?? "-"),
    customerName: String(record.customer_name ?? "-"),
    phoneNumber: String(record.phone_number ?? "-"),
    shippingAddress: String(record.shipping_address ?? "-"),
    bankAccount: String(record.bank_account ?? "Not provided"),
    bankAccountNumber: String(record.bank_account_number ?? ""),
    status: String(record.status ?? "Active"),
  };
};

export default function MasterCustomerPage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);

  const { data: customers = [], refetch } = useListCustomersQuery(undefined, {
    skip: !apiEnabled,
  });

  const [deleteCustomer, deleteState] = useDeleteCustomerMutation();

  const [searchValue, setSearchValue] = useState("");
  const [selectedRow, setSelectedRow] = useState<CustomerRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedId = selectedRow?.id;
  const detailQuery = useGetCustomerByIdQuery(selectedId ?? "", {
    skip: !apiEnabled || !detailOpen || !selectedId,
  });

  const rows = useMemo(
    () => customers.map((r, i) => toCustomerRow(r, i)),
    [customers]
  );

  const filteredRows = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.customerId, row.customerName, row.phoneNumber, row.shippingAddress]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, searchValue]);

  const columns: ColumnsType<CustomerRow> = [
    {
      title: "Customer ID",
      dataIndex: "customerId",
      key: "customerId",
      width: 140,
      render: (value: string) => (
        <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
          {value}
        </span>
      ),
    },
    {
      title: "Customer Name",
      dataIndex: "customerName",
      key: "customerName",
      width: 260,
      render: (value: string) => (
        <span className="font-semibold text-gray-900">{value}</span>
      ),
    },
    {
      title: "Phone Number",
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      width: 180,
      render: (value: string) => <span className="text-gray-700">{value}</span>,
    },
    {
      title: "Shipping Address",
      dataIndex: "shippingAddress",
      key: "shippingAddress",
      width: 360,
      render: (value: string) => (
        <span className="text-gray-700 line-clamp-2">{value}</span>
      ),
    },
    {
      title: "Bank Account",
      key: "bank",
      width: 220,
      render: (_value, row) => (
        <div className="text-sm text-gray-700">
          <div className="font-semibold">{row.bankAccount}</div>
          {row.bankAccountNumber ? (
            <div className="text-xs text-gray-500">{row.bankAccountNumber}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (value: string) => {
        const v = String(value ?? "").toLowerCase();
        const isActive = v === "active" || v === "1" || v === "true";
        return <Tag color={isActive ? "green" : "default"}>{value}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
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
                message.error("Missing customer id");
                return;
              }
              router.push(`/master-customer/${encodeURIComponent(String(row.id))}/edit`);
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
          <h1 className="text-2xl font-bold text-gray-900">Master Customer</h1>
          <p className="text-gray-600">
            Manage customer database and information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="!rounded-lg">Import</Button>
          <Button className="!rounded-lg">Export</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push("/master-customer/create")}
            className="!rounded-lg"
          >
            Add Customer
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Input
            allowClear
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search by customer name, ID, or phone number..."
            prefix={<SearchOutlined />}
            className="w-full md:w-[420px]"
          />
          <div className="text-xs text-gray-500">{filteredRows.length} customers</div>
        </div>

        <Table<CustomerRow>
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
        title="Customer Detail"
      >
        {selectedRow ? (
          detailQuery.isFetching ? (
            <div className="text-sm text-gray-500">Loading detail...</div>
          ) : detailQuery.isError ? (
            <div className="text-sm text-red-600">
              {getApiErrorMessage(detailQuery.error, "Failed to load customer detail")}
            </div>
          ) : (
            (() => {
              const d = detailQuery.data;
              const customerId = String(d?.customer_id ?? d?.customer_code ?? selectedRow.customerId ?? "-");
              const customerName = String(d?.customer_name ?? selectedRow.customerName ?? "-");
              const phoneNumber = String(d?.phone_number ?? selectedRow.phoneNumber ?? "-");
              const shippingAddress = String(d?.shipping_address ?? selectedRow.shippingAddress ?? "-");
              const billingSame = Boolean(d?.billing_same_as_shipping);
              const billingAddress = d?.billing_address == null ? "-" : String(d.billing_address);
              const bankAccount = d?.bank_account == null ? "Not provided" : String(d.bank_account);
              const bankNumber = d?.bank_account_number == null ? "" : String(d.bank_account_number);

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Customer ID</div>
                    <div className="font-semibold text-gray-900">{customerId}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Customer Name</div>
                    <div className="font-semibold text-gray-900">{customerName}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Phone Number</div>
                    <div className="text-gray-900">{phoneNumber}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Billing Same As Shipping</div>
                    <div className="text-gray-900">{billingSame ? "Yes" : "No"}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-gray-500">Shipping Address</div>
                    <div className="text-gray-900">{shippingAddress}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-gray-500">Billing Address</div>
                    <div className="text-gray-900">{billingAddress}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Bank Account</div>
                    <div className="text-gray-900">{bankAccount}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Bank Account Number</div>
                    <div className="text-gray-900">{bankNumber || "-"}</div>
                  </div>
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
        okButtonProps={{
          danger: true,
          className: "!rounded-lg",
          loading: deleteState.isLoading,
        }}
        cancelButtonProps={{ className: "!rounded-lg" }}
        onOk={async () => {
          try {
            if (!selectedRow?.id) throw new Error("Missing customer id");
            await deleteCustomer(selectedRow.id).unwrap();
            message.success("Customer deleted");
            setDeleteOpen(false);
            setSelectedRow(null);
            refetch();
          } catch (error) {
            message.error(getApiErrorMessage(error, "Failed to delete customer"));
          }
        }}
        title="Delete customer?"
      >
        <div>
          Delete <span className="font-semibold">{selectedRow?.customerName}</span>?
        </div>
      </Modal>
    </div>
  );
}
