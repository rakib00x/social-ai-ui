// 👤 Admin Management (Super Admin only)

"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const ADMIN_KEY_LS = "social_ai_admin_key_v1";

function buildAdminHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("admin_token_v1") || "";
  if (token) return { Authorization: `Bearer ${token}` };
  const key = window.localStorage.getItem(ADMIN_KEY_LS) || "";
  return key ? { "x-admin-key": key } : {};
}

type SubAdmin = {
  id: string;
  email: string;
  must_set_password?: number;
  is_active: number;
  token_version?: number;
  created_at: string;
  updated_at: string;
};

type AuditLog = {
  id: string;
  actor_email: string | null;
  actor_type: string;
  action: string;
  target_email: string | null;
  created_at: string;
  meta_json?: any;
};

async function safeReadJsonMessage(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return String(j?.message || res.statusText);
  } catch {
    return String(res.statusText || "Request failed");
  }
}

export default function AdminManagementPage() {
  const [items, setItems] = useState<SubAdmin[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [tab, setTab] = useState<"sub" | "audit">("sub");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/sub-admins`, {
        headers: { "Content-Type": "application/json", ...buildAdminHeaders() },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await safeReadJsonMessage(res));
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);

      // Load latest audit logs (best-effort)
      try {
        const al = await fetch(`${API}/api/admin/audit-logs?limit=50`, {
          headers: { "Content-Type": "application/json", ...buildAdminHeaders() },
          cache: "no-store",
        });
        if (al.ok) {
          const aj = await al.json();
          setAudit(Array.isArray(aj?.items) ? aj.items : []);
        }
      } catch {
        // ignore
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async () => {
    setErr("");
    try {
      const res = await fetch(`${API}/api/admin/sub-admins/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAdminHeaders() },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await safeReadJsonMessage(res));
      const j = await res.json();
      setInviteLink(String(j?.inviteLink || ""));
      setEmail("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to invite");
    }
  };

  const resendInvite = async (email: string) => {
    setErr("");
    try {
      const res = await fetch(`${API}/api/admin/sub-admins/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAdminHeaders() },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await safeReadJsonMessage(res));
      const j = await res.json();
      setInviteLink(String(j?.inviteLink || ""));
      alert("Invite link generated. Copy it and send to the sub admin.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to resend invite");
    }
  };

  const toggleActive = async (id: string, nextActive: boolean) => {
    setErr("");
    try {
      const res = await fetch(`${API}/api/admin/sub-admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...buildAdminHeaders() },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (!res.ok) throw new Error(await safeReadJsonMessage(res));
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to update");
    }
  };

  const resetPassword = async (id: string) => {
    const next = prompt("New password (10+ chars with upper, lower, number, symbol):");
    if (!next) return;
    setErr("");
    try {
      const res = await fetch(`${API}/api/admin/sub-admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...buildAdminHeaders() },
        body: JSON.stringify({ password: next }),
      });
      if (!res.ok) throw new Error(await safeReadJsonMessage(res));
      alert("Password updated");
    } catch (e: any) {
      setErr(e?.message || "Failed to reset password");
    } finally {
      await load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this sub admin?")) return;
    setErr("");
    try {
      const res = await fetch(`${API}/api/admin/sub-admins/${id}`, {
        method: "DELETE",
        headers: { ...buildAdminHeaders() },
      });
      if (!res.ok) throw new Error(await safeReadJsonMessage(res));
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete");
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-black/10 rounded-xl p-4">
          <div className="text-xl font-bold">👤 Admin Management</div>
          <div className="text-xs text-gray-500 mt-1">Invite / disable / reset for sub admins (super admin only)</div>

          {err ? (
            <div className="mt-3 p-3 border border-red-200 bg-red-50 rounded-lg text-red-700 text-sm">{err}</div>
          ) : null}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setTab("sub")}
              className={`px-3 py-2 rounded-lg border border-black/10 text-sm ${tab === "sub" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
            >
              Sub Admins
            </button>
            <button
              onClick={() => setTab("audit")}
              className={`px-3 py-2 rounded-lg border border-black/10 text-sm ${tab === "audit" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
            >
              Audit Logs
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Sub admin email"
              className="px-3 py-2 rounded-lg border border-black/10"
            />
            <button
              onClick={invite}
              className="px-4 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
            >
              ✉️ Send Invite
            </button>
            <button
              onClick={() => {
                const pw = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                  .map((b) => (b % 36).toString(36))
                  .join("")
                  .slice(0, 12);
                navigator.clipboard?.writeText(pw);
                alert("A random password was copied to clipboard. You can use Reset Password if needed.");
              }}
              className="px-4 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition"
            >
              🔒 Generate Password
            </button>
          </div>

          {inviteLink ? (
            <div className="mt-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
              <div className="font-semibold">Invite Link</div>
              <div className="break-all text-xs mt-1">{inviteLink}</div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteLink);
                    alert("Copied!");
                  }}
                  className="px-3 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition text-sm"
                >
                  Copy
                </button>
                <button
                  onClick={() => setInviteLink("")}
                  className="px-3 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {tab === "sub" ? (
        <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-black/10 flex items-center justify-between">
            <div className="font-semibold">Sub Admins</div>
            <button
              onClick={load}
              className="px-3 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition text-sm"
            >
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          <div className="divide-y divide-black/10">
            {items.map((a) => (
              <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex-1">
                  <div className="font-semibold">{a.email}</div>
                  <div className="text-xs text-gray-500">
                    ID: {a.id} • Active: {a.is_active ? "Yes" : "No"} • Status: {a.must_set_password ? "Invite Pending" : "Ready"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(a.id, !a.is_active)}
                    className="px-3 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition text-sm"
                  >
                    {a.is_active ? "Disable" : "Enable"}
                  </button>

                  <button
                    onClick={() => resetPassword(a.id)}
                    className="px-3 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition text-sm"
                  >
                    Reset Password
                  </button>

                  <button
                    onClick={() => resendInvite(a.email)}
                    className="px-3 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition text-sm"
                  >
                    Resend Invite
                  </button>

                  <button
                    onClick={() => remove(a.id)}
                    className="px-3 py-2 rounded-lg border border-black/10 hover:bg-red-600 hover:text-white transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {!items.length ? (
              <div className="p-6 text-sm text-gray-500">{loading ? "Loading..." : "No sub admins yet"}</div>
            ) : null}
          </div>
        </div>
        ) : (
          <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-black/10 flex items-center justify-between">
              <div className="font-semibold">Audit Logs (last 50)</div>
              <button
                onClick={load}
                className="px-3 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition text-sm"
              >
                {loading ? "Loading..." : "↻ Refresh"}
              </button>
            </div>
            <div className="divide-y divide-black/10">
              {audit.map((l) => (
                <div key={l.id} className="p-4 text-sm">
                  <div className="font-semibold">{l.action}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    By: {l.actor_email || "(system)"} • Target: {l.target_email || "-"} • {l.created_at}
                  </div>
                </div>
              ))}
              {!audit.length ? <div className="p-6 text-sm text-gray-500">No logs yet</div> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
