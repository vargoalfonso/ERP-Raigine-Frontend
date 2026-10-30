"use client";

import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import {
  normalizeDateRange,
  type DateRangeValue,
} from "@/lib/utils/dateRange";

const { RangePicker } = DatePicker;

type Props = {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  className?: string;
  placeholder?: [string, string];
};

const presets: { label: string; value: [Dayjs, Dayjs] }[] = [
  { label: "Today", value: [dayjs(), dayjs()] },
  { label: "Last 7 Days", value: [dayjs().subtract(6, "day"), dayjs()] },
  { label: "Last 30 Days", value: [dayjs().subtract(29, "day"), dayjs()] },
  {
    label: "This Month",
    value: [dayjs().startOf("month"), dayjs().endOf("month")],
  },
  {
    label: "Last Month",
    value: [
      dayjs().subtract(1, "month").startOf("month"),
      dayjs().subtract(1, "month").endOf("month"),
    ],
  },
];

/** Filter rentang tanggal yang dipakai bersama di halaman inventory. */
export default function DateRangeFilter({
  value,
  onChange,
  className,
  placeholder = ["Start date", "End date"],
}: Props) {
  return (
    <RangePicker
      value={value}
      onChange={(v) => onChange(normalizeDateRange(v))}
      presets={presets}
      allowClear
      format="YYYY-MM-DD"
      placeholder={placeholder}
      className={className}
    />
  );
}
