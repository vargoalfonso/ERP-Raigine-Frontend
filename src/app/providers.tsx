"use client";

import { store } from "@/lib/api/store";
import { Provider } from "react-redux";
import "@/lib/antdRender";
import { SessionExpiredModal } from "@/components/SessionExpired/SessionExpiredModal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      {children}
      <SessionExpiredModal />
    </Provider>
  );
}
