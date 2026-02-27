import { Suspense } from "react";
import SubConMaterialsClient from "./SubConMaterialsClient";

export const dynamic = "force-dynamic";

export default function SubConMaterialsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading...</div>}>
      <SubConMaterialsClient />
    </Suspense>
  );
}
