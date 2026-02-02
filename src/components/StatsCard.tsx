interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  subtitle?: string;
  change?: string;
  changeType?: "positive" | "negative";
}

export default function StatsCard({
  title,
  value,
  icon,
  bgColor,
  textColor,
  subtitle,
  change,
  changeType = "positive",
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
            </div>
            <div className={`p-2 rounded-lg ${bgColor} ${textColor}`}>
              {icon}
            </div>
          </div>
          {subtitle && <p className="text-sm text-gray-500 mb-2">{subtitle}</p>}
          {change && (
            <div className="flex items-center gap-1">
              <svg
                className={`w-4 h-4 ${
                  changeType === "positive" ? "text-green-500" : "text-red-500"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    changeType === "positive"
                      ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  }
                />
              </svg>
              <span
                className={`text-sm font-medium ${
                  changeType === "positive" ? "text-green-600" : "text-red-600"
                }`}
              >
                {change}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
