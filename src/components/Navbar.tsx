"use client";

import { apiBaseUrl, apiSlice, getCookiesFromBrowser } from "@/lib/api/instance";
import { getCurrentUserProfile, getCurrentUserTokenPayload, getCurrentUserUid, type CurrentUserProfile } from "@/lib/utils/currentUser";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { MdCircle } from "react-icons/md";
import { useDispatch } from "react-redux";

// Mapping path ke title
const getPageTitle = (pathname: string): string => {
  const pathTitleMap: { [key: string]: string } = {
    "/dashboard": "Dashboard",
    "/production-dashboard": "Production Dashboard",
    "/qc-dashboard": "QC Dashboard",
    "/approval-manager": "Approval Manager",
    "/shop-floor": "Shop Floor Control",
    "/system-settings": "System Settings",
    "/system-settings/access-control-matrix/create": "Add User Access Control",
    "/system-settings/roles/create": "Create New Role",
    "/system-settings/roles/detail": "Role Details",
    "/system-settings/safety-stock/create": "Add Parameter for Safety Stock",
    "/system-settings/stockdays/create": "Add Parameter for Stockdays Option",
    "/system-settings/buy-not-buy-flag/create": "Add Parameter for Buy/Not Buy",
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
    "/master-customer": "Master Customer",
    "/master-customer/create": "Add Customer",
    "/master-warehouse": "Master Warehouse Management",
    "/master-warehouse/create": "Add Warehouse",
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
    "/po-procurement": "Purchase Order Management",
    "/po-procurement/create": "Create Purchase Order",
    "/po-procurement/detail": "Purchase Order Details",
    "/demand-forecasting": "Demand Forecasting",
    "/prl-pattern-history": "PRL Pattern History",
    "/po-budget": "PR Budgeting",
    "/master-supplier/performance-management": "Supplier Performance Management",
    "/machine-master-data": "Machine Master Data",
    "/machine-pattern": "Machine Pattern",
    "/product-return": "Product Return",
    "/delivery-scheduling": "Delivery Scheduling",
    "/employee-dept": "Employee and Department Management",
    "/robot-automation": "Robot Automation",
  };

  if (pathname.startsWith("/dn-management/detail")) return "DN Raw Material Details";
  if (pathname.startsWith("/po-procurement/detail")) return "Purchase Order Details";

  return pathTitleMap[pathname] || "";
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
  // Computed after mount to avoid SSR/client hydration mismatch (locale/timezone).
  const [currentDate, setCurrentDate] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();
  // Start from a deterministic default so the server-rendered HTML matches the
  // client's first render. The real profile (from cookie/JWT) is loaded in the
  // effect below, which only runs on the client.
  const DEFAULT_USER_PROFILE: CurrentUserProfile = {
    displayName: null,
    role: null,
    initials: "AI",
  };
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile>(
    DEFAULT_USER_PROFILE,
  );
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    setCurrentDate(getCurrentDate());
    let cancelled = false;

    const hydrateCurrentUser = async () => {
      const baseProfile = getCurrentUserProfile();
      if (!cancelled) {
        setCurrentUser(baseProfile);
      }

      const payload = getCurrentUserTokenPayload();
      const uid = getCurrentUserUid();

      // Try UID-based profile fetch first (more reliable when token lacks email/username)
      if (uid && apiBaseUrl) {
        try {
          const token = getCookiesFromBrowser("Authorization");
          const response = await fetch(`${apiBaseUrl}/user/${uid}`, {
            method: "GET",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (response.ok) {
            const json = await response.json().catch(() => null);
            const userRecord = json?.data ?? json ?? null;
            const username = typeof userRecord?.username === "string" && userRecord.username.trim() ? userRecord.username.trim() : null;

            if (!cancelled && username) {
              setCurrentUser((prev) => ({
                ...prev,
                displayName: username,
                initials: username
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part: string) => part.charAt(0).toUpperCase())
                  .join("") || prev.initials,
              }));
              return; // done
            }
          }
        } catch {
          // ignore and fall back to email-based lookup below
        }
      }

      // Fallback: try matching by email across /user list (keeps previous behavior)
      const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
      if (!email || !apiBaseUrl) return;

      try {
        const token = getCookiesFromBrowser("Authorization");
        const response = await fetch(`${apiBaseUrl}/user`, {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!response.ok) return;

        const json = await response.json().catch(() => null);
        const rawList = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.data?.items)
              ? json.data.items
              : [];

        const matchedUser = rawList.find((item: any) => {
          const itemEmail = typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
          return itemEmail === email;
        });

        const username =
          typeof matchedUser?.username === "string" && matchedUser.username.trim()
            ? matchedUser.username.trim()
            : null;

        if (!cancelled && username) {
          setCurrentUser((prev) => ({
            ...prev,
            displayName: username,
            initials: username
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part: string) => part.charAt(0).toUpperCase())
              .join("") || prev.initials,
          }));
        }
      } catch {
        // ignore DB username fallback failures and keep token-derived profile
      }
    };

    void hydrateCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

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
              onClick={() => setShowProfileMenu((s) => !s)}
              className="flex items-center space-x-2 p-2 bg-[#F1F5FF] hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">{currentUser.initials}</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">
                  {currentUser.displayName || "User"}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser.role || "No role assigned"}
                </p>
              </div>
              {/* <MdExpandMore className="w-4 h-4 text-gray-500" /> */}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  type="button"
                  onClick={() => {
                    // navigate to profile settings (placeholder)
                    setShowProfileMenu(false);
                    router.push("/profile");
                  }}
                  className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    router.push("/account");
                  }}
                  className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Account Settings
                </button>
                <hr className="my-2" />
                <button
                  type="button"
                  onClick={() => {
                    // Clear auth cookies/token and redirect to login
                    try {
                      document.cookie = "Authorization=; path=/; max-age=0";
                      sessionStorage.clear();
                      localStorage.removeItem("Authorization");
                      dispatch(apiSlice.util.resetApiState());
                    } catch (e) {
                      // ignore
                    }
                    setShowProfileMenu(false);
                    window.location.replace("/login");
                  }}
                  className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}