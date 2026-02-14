//Admin Dashboard 📥 Seller Inbox👥 Create Sellers⚙️ Api Intigration 🚪 Logout

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const pathname = usePathname();

  // ✅ login page এ sidebar/topbar/drawer দেখাবে না
  const isLoginPage =
    pathname === "/admin/login" ||
    pathname === "/admin" ||
    pathname?.startsWith("/admin/login/");

  
  useEffect(() => {
    let cancelled = false;

    const fallbackDecode = (token: string) => {
      try {
        const parts = token.split(".");
        if (parts.length < 2) return false;
        const payloadJson = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        return payloadJson?.adminType === "super";
      } catch {
        return false;
      }
    };

    const loadMe = async () => {
      try {
        const token = window.localStorage.getItem("admin_token_v1") || "";
        if (!token) {
          if (!cancelled) setIsSuperAdmin(false);
          return;
        }

        // Prefer server truth (handles token refresh without full reload)
        const res = await fetch(`${API}/api/admin/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          if (!cancelled) setIsSuperAdmin(j?.adminType === "super");
          return;
        }

        // Fallback: decode token (still fixes the "needs refresh" issue)
        if (!cancelled) setIsSuperAdmin(fallbackDecode(token));
      } catch {
        const token = window.localStorage.getItem("admin_token_v1") || "";
        if (!cancelled) setIsSuperAdmin(fallbackDecode(token));
      }
    };

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const Sidebar = useMemo(
    () => (
      <div className="h-full bg-white border-r border-black/10">
        <div className="p-2 border-b border-black/10">

      

          <div className="text-xl font-bold">Admin Dashboard</div>
          <div className="text-xs text-gray-500 mt-1">Social AI Bot</div>
        </div>

        <nav className="p-3 space-y-2">
          <a
            href="/admin/inbox"
            className="block px-4 py-3 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
          >
            📥 Seller Inbox
          </a>
          <a
            href="/admin/sellers"
            className="block px-4 py-3 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
          >
            👥 Create Sellers
          </a>
          {/* <a
            href="/admin/seller"
            className="block px-4 py-3 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
          >
            ⚙️ Api Intigration---
          </a> */}

          <a
            href="/admin/api"
            className="block px-4 py-3 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
          >
            ⚙️ API Integration
          </a>
          {isSuperAdmin ? (
            <a
              href="/admin/admin-management"
              className="block px-4 py-3 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
            >
              👤 Admin Management
            </a>
          ) : null}

          <a
            href="/admin/logout"
            className="block px-4 py-3 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
          >
            🚪 Logout
          </a>
        </nav>
      </div>
    ),
    [isSuperAdmin]
  );

  // ✅ Login page: শুধু children (login form) center এ দেখাও
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
        <main className="w-full px-4">
          <div className="mx-auto w-full max-w-[520px]">{children}</div>
        </main>
      </div>
    );
  }

  // ✅ Other admin pages: full dashboard layout
  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Mobile topbar */}
      <div className="md:hidden sticky top-0 z-40 border-b border-black/10 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-4 py-2 text-sm hover:bg-black hover:text-white transition"
            aria-label="Open menu"
          >
            ☰ Menu
          </button>
          <div className="text-sm font-semibold">Admin</div>
          <div className="w-[64px]" />
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[82%] max-w-[340px] shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 bg-white">
              <div className="text-sm font-semibold">Menu</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:bg-black hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-52px)] overflow-y-auto">{Sidebar}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12">
        {/* Desktop sidebar */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-2">
          {Sidebar}
        </aside>

        {/* Content */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          {children}
        </main>
      </div>
    </div>
  );
}
