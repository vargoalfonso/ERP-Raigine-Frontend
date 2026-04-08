"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RoleDetailRedirectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("id") ?? "";
    const name = searchParams.get("name") ?? "";
    const qs = new URLSearchParams();
    qs.set("mode", "detail");
    if (id) qs.set("id", id);
    if (name) qs.set("name", name);
    router.replace(`/system-settings/roles/create?${qs.toString()}`);
  }, [router, searchParams]);

  return null;
}

export default function RoleDetailRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RoleDetailRedirectPageContent />
    </Suspense>
  );
}
