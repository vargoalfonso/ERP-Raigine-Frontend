import React from "react";

export default function StatsCardStatus({
  title,
  value,
  icon,
  textColor,
  borderColor,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  textColor: string;
  borderColor: string;
}) {
  return (
    <div
      style={{
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "24px",
        background: "#fff",
      }}
      className={`w-full border-1 ${borderColor}`}
    >
      {/* Warning Icon */}
      <div className={textColor}>{icon}</div>
      {/* Text and Number */}
      <div className={textColor}>
        <div className="text-2xl font-normal">{title}</div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
      </div>
    </div>
  );
}
