"use client";

import { usePathname } from "next/navigation";
import { MdCircle } from "react-icons/md";

// Mapping path ke title
const getPageTitle = (pathname: string): string => {
  const pathTitleMap: { [key: string]: string } = {
    "/dashboard": "Dashboard",
    "/production-dashboard": "Production Dashboard",
    "/qc-dashboard": "QC Dashboard",
    "/shop-floor": "Shop Floor Control",
    "/system-settings": "System Settings",
    "/system-settings/access-control-matrix/create": "Add User Access Control",
    "/system-settings/roles/create": "Create New Role",
    "/system-settings/roles/detail": "Role Details",
    "/system-settings/safety-stock/create": "Add Parameter for Safety Stock",
    "/system-settings/stockdays/create": "Add Parameter for Stockdays Option",
    "/system-settings/type-parameters/create": "Add WIP Type",
    "/system-settings/uom-global/create": "Add UoM Parameter (Global)",
    "/system-settings/purchase-order/create": "Add PO - Split Settings",
    "/system-settings/approval-workflow/create": "Add Approval Workflow",
    "/system-settings/kanban/create": "Add Kanban - FG Standards",
    "/system-settings/global/create": "Add Global - Working Days",
    "/system-settings/process/create": "Add Process",
    "/system-settings/machine/pattern/create": "Add Machine Pattern",
    "/prl-management": "PRL Management",
    "/customer-po": "Customer PO & DN",
    "/master-supplier": "Master Supplier",
    "/master-supplier/create": "Add Master Supplier Item",
    "/master-supplier/only/create": "Add Supplier (Only)",
    "/bill-of-material": "Bill Of Material",
    "/work-orders": "Work Orders",
    "/finished-goods": "Finished Goods",
    "/work-in-progress": "Work In-Progress",
    "/scrap-stock": "Scrap Stock",
    "/raw-materials": "Raw Materials",
    "/outgoing-raw-material": "Outgoing - Raw Material",
    "/indirect-raw-materials": "Indirect Raw Material",
    "/indirect-raw-material/create": "Add Indirect Raw Material",
    "/indirect-raw-material/detail": "Indirect Raw Material Details",
    "/sub-con-materials": "Sub Con Materials",
    "/sub-con-materials/create": "Add Stock Received from Vendor",
    "/sub-con-materials/detail": "SubCon Stock In Vendor Details",
    "/dn-management": "DN Management",
    "/dn-management/detail": "DN Raw Material Details",
    "/stock-opname": "Stock Opname",
  };

  if (pathname.startsWith("/dn-management/detail")) return "DN Raw Material Details";
  return pathTitleMap[pathname] || "Dashboard";
};

// Format tanggal
const getCurrentDate = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return now.toLocaleDateString("en-US", options);
};

export default function Navbar() {
  //   const [showProfileMenu, setShowProfileMenu] = useState(false);
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const currentDate = getCurrentDate();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left Section - Logo, Back Button, Title */}
        <div className="flex items-center space-x-4">
          {/* Page Title and Info */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{pageTitle}</h2>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-sm text-gray-500">{currentDate}</span>
              <div className="flex items-center space-x-1">
                <MdCircle className="w-2 h-2 text-green-500" />
                <span className="text-sm text-gray-600">AI System Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Notifications & Profile */}
        <div className="flex items-center space-x-4">
          {/* Profile Dropdown */}
          <div className="relative">
            <button
              //   onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 p-2 bg-[#F1F5FF] hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">AI</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">MRP Admin</p>
                <p className="text-xs text-gray-500">Admin Manufacturing</p>
              </div>
              {/* <MdExpandMore className="w-4 h-4 text-gray-500" /> */}
            </button>

            {/* Dropdown Menu */}
            {/* {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile Settings
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Account Settings
                </a>
                <hr className="my-2" />
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign Out
                </a>
              </div>
            )} */}
          </div>
        </div>
      </div>
    </header>
  );
}
