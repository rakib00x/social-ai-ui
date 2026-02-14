"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

async function safeReadJsonMessage(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return String(j?.message || res.statusText);
  } catch {
    return String(res.statusText || "Request failed");
  }
}

export default function AcceptInvitePage() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => String(sp.get("token") || ""), [sp]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (!token) setErr("Missing invite token");
  }, [token]);

  const submit = async () => {
    setErr("");
    setOkMsg("");
    if (!token) return setErr("Missing invite token");
    if (!password) return setErr("Password is required");
    if (password !== confirm) return setErr("Passwords do not match");

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) throw new Error(await safeReadJsonMessage(res));
      const j = await res.json();
      setOkMsg("Password set successfully. Redirecting to login...");

      // Pre-fill the username field using query string
      const email = encodeURIComponent(String(j?.email || ""));
      setTimeout(() => {
        router.replace(`/admin/login?username=${email}`);
      }, 800);
    } catch (e: any) {
      setErr(e?.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-black/10 rounded-xl p-5">
        <div className="text-xl font-bold">Set your password</div>
        <div className="text-xs text-gray-500 mt-1">
          This invite link expires after a short time. Choose a strong password.
        </div>

        {err ? <div className="mt-3 p-3 border border-red-200 bg-red-50 rounded-lg text-red-700 text-sm">{err}</div> : null}
        {okMsg ? <div className="mt-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg text-emerald-700 text-sm">{okMsg}</div> : null}

        <div className="mt-4 space-y-3">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="New password (10+ chars, upper/lower/number/symbol)"
            className="w-full px-3 py-2 rounded-lg border border-black/10"
          />
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            placeholder="Confirm password"
            className="w-full px-3 py-2 rounded-lg border border-black/10"
          />

          <button
            onClick={submit}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg border border-black/10 hover:bg-black hover:text-white transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save password"}
          </button>

          <div className="text-xs text-gray-500">
            Tip: Use a password manager. Strong password = 10+ chars with upper, lower, number, and symbol.
          </div>
        </div>
      </div>
    </div>
  );
}
