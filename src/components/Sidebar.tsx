"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MdChevronLeft,
  MdChevronRight,
  MdHome,
  MdBarChart,
  MdShoppingBag,
  MdDescription,
  MdSettings,
  MdGroup,
  MdStorefront,
  MdBuild,
  MdArchive,
  MdSchedule,
  MdWarning,
  MdScience,
  MdContentCopy,
} from "react-icons/md";
import { HiOutlineArchiveBox } from "react-icons/hi2";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: string }>;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: MdHome,
    href: "/dashboard",
  },
  {
    id: "production-dashboard",
    label: "Production Dashboard",
    icon: MdBarChart,
    href: "/production-dashboard",
  },
  {
    id: "qc-dashboard",
    label: "QC Dashboard",
    icon: MdScience,
    href: "/qc-dashboard",
  },
  {
    id: "sales",
    label: "Shop Floor",
    icon: MdShoppingBag,
    href: "/shop-floor",
  },
  {
    id: "system",
    label: "System Settings",
    icon: MdSettings,
    href: "/system-settings",
  },
  {
    id: "sales-section",
    label: "SALES",
    icon: MdDescription,
    children: [
      {
        id: "prl-management",
        label: "PRL Management",
        icon: MdDescription,
        href: "/prl-management",
      },
      {
        id: "customer-po",
        label: "Customer PO & DN",
        icon: MdContentCopy,
        href: "/customer-po",
      },
    ],
  },
  {
    id: "master-data",
    label: "MASTER DATA",
    icon: MdArchive,
    children: [
      {
        id: "master-supplier",
        label: "Master Supplier",
        icon: MdGroup,
        href: "/master-supplier",
      },
    ],
  },
  {
    id: "products",
    label: "PRODUCTS",
    icon: MdStorefront,
    children: [
      {
        id: "bill-of-material",
        label: "Bill Of Material",
        icon: MdDescription,
        href: "/bill-of-material",
      },
    ],
  },
  {
    id: "manufacturing",
    label: "MANUFACTURING",
    icon: MdBuild,
    children: [
      {
        id: "work-orders",
        label: "Work Orders",
        icon: MdDescription,
        href: "/work-orders",
      },
    ],
  },
  {
    id: "inventory",
    label: "INVENTORY",
    icon: MdArchive,
    children: [
      {
        id: "finished-goods",
        label: "Finished Goods",
        icon: HiOutlineArchiveBox,
        href: "/finished-goods",
      },
      {
        id: "work-in-progress",
        label: "Work In-Progress",
        icon: MdSchedule,
        href: "/work-in-progress",
      },
      {
        id: "scrap-stock",
        label: "Scrap Stock",
        icon: MdWarning,
        href: "/scrap-stock",
      },
      {
        id: "raw-materials",
        label: "Raw Materials",
        icon: MdScience,
        href: "/raw-materials",
      },
      {
        id: "outgoing-raw-material",
        label: "Outgoing - Raw Material",
        icon: MdScience,
        href: "/outgoing-raw-material",
      },
      {
        id: "indirect-material-raw",
        label: "Indirect Material Raw",
        icon: MdScience,
        href: "/indirect-raw-materials",
      },
      {
        id: "sub-con-materials",
        label: "Sub Con Materials",
        icon: MdScience,
        href: "/sub-con-materials",
      },
      {
        id: "dn-management",
        label: "DN Management",
        icon: MdContentCopy,
        href: "/dn-management",
      },
      {
        id: "stock-opname",
        label: "Stock Opname",
        icon: MdDescription,
        href: "/stock-opname",
      },
    ],
  },
];

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isSection = item.children && item.children.length > 0;
    const Icon = item.icon;

    if (isSection) {
      return (
        <div key={item.id} className="mb-2">
          {/* Section Header - hanya label tanpa icon */}
          {isExpanded && (
            <div className="px-3 py-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {item.label}
              </span>
            </div>
          )}

          {/* Section Children - selalu tampil */}
          <div className="ml-0">
            {item.children?.map((child) => renderMenuItem(child, level + 1))}
          </div>
        </div>
      );
    }

    // Regular menu item
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.id}
        href={item.href || "#"}
        className={`flex items-center ${
          isExpanded ? "justify-start space-x-4" : "justify-center"
        } px-3 py-2 mb-1 transition-colors duration-200 group ${
          isActive
            ? "bg-blue-100 text-blue-600 hover:bg-blue-700 hover:text-white rounded-md"
            : "text-gray-800 hover:bg-blue-50 hover:text-blue-600"
        }`}
      >
        <Icon
          className={`w-5 h-5 flex-shrink-0 ${
            isActive ? " hover:text-white " : "text-gray-700 w-5 h-5"
          } `}
        />
        {isExpanded && (
          <span
            className={`text-sm ${isActive ? "font-medium" : "text-gray-700"}`}
          >
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div
      className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
        isExpanded ? "w-64" : "w-16"
      } h-screen flex flex-col relative`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {isExpanded && (
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">AI ERP</h1>
                <p className="text-xs text-gray-500">
                  Manufacturing Intelligence
                </p>
              </div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            {isExpanded ? (
              <MdChevronLeft className="w-5 h-5 text-gray-600" />
            ) : (
              <div className="py-2">
                <MdChevronRight className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {menuItems.map((item) => renderMenuItem(item))}
        </div>
      </nav>
    </div>
  );
}
