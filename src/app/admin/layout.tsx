"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AdminNavbar } from "@/components/AdminNavbar";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession({ required: true });
  const router = useRouter();
  const token  = useApiToken();
  const role   = (session?.user as { role?: string })?.role ?? "";
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (status === "authenticated" && role && role !== "platform_admin") {
      router.replace("/auth/login");
    }
  }, [status, role, router]);

  useEffect(() => {
    if (!token || role !== "platform_admin") return;
    apiFetch("/api/admin/distributors?approved=false&limit=1", { method: "GET", token })
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json() as { pagination?: { total: number } };
        setPendingCount(d.pagination?.total ?? 0);
      })
      .catch(() => {});
  }, [token, role]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
      </div>
    );
  }

  if (role !== "platform_admin") return null;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <AdminNavbar pendingCount={pendingCount} />
      {children}
    </div>
  );
}
