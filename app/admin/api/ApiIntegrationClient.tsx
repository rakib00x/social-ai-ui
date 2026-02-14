"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const ADMIN_KEY_LS = "social_ai_admin_key_v1";

function buildAdminHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("admin_token_v1") || "";
  if (token) return { Authorization: `Bearer ${token}` };
  const key = window.localStorage.getItem(ADMIN_KEY_LS) || "";
  return key ? { "x-admin-key": key } : {};
}

async function safeReadJsonMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.message || data?.error || data?.warn || "";
  } catch {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }
}

type FbIntegration = {
  source: "database" | "env" | "none";
  platform: "facebook";
  pageId: string;
  pageTokenMasked: string;
  updatedAt: string | null;
};

type ConnectedPage = {
  id: number;
  platform: "facebook" | "instagram";
  page_id: string;
  page_name: string;
  updated_at: string;
};

type OAuthPage = {
  id: string;
  name: string;
};

export default function ApiIntegrationPage() {
  const searchParams = useSearchParams();
  const API_BASE = useMemo(() => {
    const envBase = process.env.NEXT_PUBLIC_API_BASE;
    if (envBase) return envBase;

    // ✅ Local dev default
    // - Next.js admin panel runs on :3000
    // - Backend API typically runs on :5000
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        return "http://localhost:5000";
      }
    }

    // Production default: same-origin (works behind a reverse proxy)
    return "";
  }, []);

  const [tab, setTab] = useState<"facebook" | "instagram" | "whatsapp">("facebook");

  const [adminKey, setAdminKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(ADMIN_KEY_LS) || "";
  });

  const [pageId, setPageId] = useState("");
  const [pageToken, setPageToken] = useState("");
  const [current, setCurrent] = useState<FbIntegration | null>(null);

  // OAuth onboarding state
  const [oauthState, setOauthState] = useState<string>("");
  const [oauthPages, setOauthPages] = useState<OAuthPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const persistAdminKey = (val: string) => {
    setAdminKey(val);
    try {
      localStorage.setItem(ADMIN_KEY_LS, val);
    } catch {
      // ignore
    }
  };

  const loadFacebook = async () => {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const headersBase = buildAdminHeaders();
      if (!headersBase.Authorization && !headersBase["x-admin-key"]) {
        throw new Error(
          "Admin login করুন অথবা Admin API Key দিন (backend .env এর ADMIN_API_KEY)"
        );
      }

      const res = await fetch(`${API_BASE}/api/integrations/facebook`, {
        method: "GET",
        headers: { ...headersBase },
        cache: "no-store",
      });

      if (!res.ok) {
        const msg = await safeReadJsonMessage(res);
        throw new Error(msg || `Failed (${res.status})`);
      }

      const data = (await res.json()) as FbIntegration;
      setCurrent(data);
      // prefill pageId; never prefill token
      if (data?.pageId) setPageId(data.pageId);
    } catch (e: any) {
      setErr(e?.message || "Failed to load integration");
    } finally {
      setLoading(false);
    }
  };

  const listConnectedPages = async (platform: "facebook" | "instagram") => {
    setErr("");
    try {
      const headersBase = buildAdminHeaders();
      if (!headersBase.Authorization && !headersBase["x-admin-key"]) {
        return; // don't hard-fail; UI will show auth requirement elsewhere
      }
      const res = await fetch(`${API_BASE}/api/integrations/${platform}/pages`, {
        method: "GET",
        headers: { ...headersBase },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setConnectedPages(Array.isArray(data?.pages) ? data.pages : []);
    } catch {
      // ignore
    }
  };

  const connectOAuth = (platform: "facebook" | "instagram") => {
    // Start OAuth at backend; callback will redirect back to this page with state
    window.location.href = `${API_BASE}/api/integrations/${platform}/oauth/start`;
  };

  const fetchOAuthPages = async (platform: "facebook" | "instagram", state: string) => {
    setErr("");
    setOk("");
    setOauthPages([]);
    setSelectedPageId("");
    try {
      const headersBase = buildAdminHeaders();
      if (!headersBase.Authorization && !headersBase["x-admin-key"]) {
        throw new Error(
          "Pages দেখাতে Admin login করুন অথবা Admin API Key দিন (backend .env এর ADMIN_API_KEY)"
        );
      }
      const res = await fetch(
        `${API_BASE}/api/integrations/${platform}/oauth/pages?state=${encodeURIComponent(state)}`,
        { method: "GET", headers: { ...headersBase }, cache: "no-store" }
      );
      if (!res.ok) {
        const msg = await safeReadJsonMessage(res);
        throw new Error(msg || `Failed (${res.status})`);
      }
      const data = await res.json();
      const pages = Array.isArray(data?.pages) ? data.pages : [];
      setOauthPages(pages.map((p: any) => ({ id: String(p.id), name: String(p.name) })));
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch pages");
    }
  };

  const addSelectedPage = async (platform: "facebook" | "instagram") => {
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const headersBase = buildAdminHeaders();
      if (!headersBase.Authorization && !headersBase["x-admin-key"]) {
        throw new Error(
          "Admin login করুন অথবা Admin API Key দিন (backend .env এর ADMIN_API_KEY)"
        );
      }
      if (!oauthState || !selectedPageId) throw new Error("Page select করুন");
      const res = await fetch(`${API_BASE}/api/integrations/${platform}/oauth/select`, {
        method: "POST",
        headers: { ...headersBase, "Content-Type": "application/json" },
        body: JSON.stringify({ state: oauthState, pageId: selectedPageId }),
      });
      if (!res.ok) {
        const msg = await safeReadJsonMessage(res);
        throw new Error(msg || `Add failed (${res.status})`);
      }
      const data = await res.json();
      setOk(data?.warn ? `Added ✅ (but: ${String(data.warn)})` : "Added ✅");
      await listConnectedPages(platform);
      // Keep oauthPages so they can add multiple pages without reconnecting
    } catch (e: any) {
      setErr(e?.message || "Failed to add page");
    } finally {
      setSaving(false);
    }
  };

  const saveFacebook = async () => {
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const headersBase = buildAdminHeaders();
      if (!headersBase.Authorization && !headersBase["x-admin-key"]) {
        throw new Error(
          "Admin login করুন অথবা Admin API Key দিন (backend .env এর ADMIN_API_KEY)"
        );
      }

      const res = await fetch(`${API_BASE}/api/integrations/facebook`, {
        method: "POST",
        headers: {
          ...headersBase,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pageId: pageId.trim(), pageToken: pageToken.trim() }),
      });

      if (!res.ok) {
        const msg = await safeReadJsonMessage(res);
        throw new Error(msg || `Save failed (${res.status})`);
      }

      const data = await res.json();
      setOk(
        data?.warn
          ? `Saved ✅ (but: ${String(data.warn)})`
          : "Saved ✅"
      );
      setPageToken("");
      await loadFacebook();
    } catch (e: any) {
      setErr(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    // Allow deep-linking / callback redirect: /admin/api?tab=facebook&state=...
    const t = String(searchParams.get("tab") || "").toLowerCase();
    if (t === "facebook" || t === "instagram" || t === "whatsapp") {
      setTab(t as any);
    }
    const st = String(searchParams.get("state") || "").trim();
    if (st) setOauthState(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (tab === "facebook") {
      loadFacebook();
      listConnectedPages("facebook");
      if (oauthState && !oauthState.startsWith("error_")) {
        fetchOAuthPages("facebook", oauthState);
      }
    }
    if (tab === "instagram") {
      listConnectedPages("instagram");
      if (oauthState && !oauthState.startsWith("error_")) {
        fetchOAuthPages("instagram", oauthState);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, oauthState]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">🔌 API Integration</h1>

      <div className="mt-4 rounded-lg border p-4">
        <div className="text-sm text-gray-600">
          Admin API Key (optional):
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={adminKey}
            onChange={(e) => persistAdminKey(e.target.value)}
            placeholder="ADMIN_API_KEY (optional if admin login token exists)"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              try {
                localStorage.removeItem(ADMIN_KEY_LS);
              } catch {}
              setAdminKey("");
            }}
            className="rounded border px-3 py-2 text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setTab("facebook")}
          className={`rounded px-4 py-2 text-sm border ${
            tab === "facebook" ? "bg-black text-white" : "bg-white"
          }`}
        >
          Facebook Page
        </button>
        <button
          onClick={() => setTab("instagram")}
          className={`rounded px-4 py-2 text-sm border ${
            tab === "instagram" ? "bg-black text-white" : "bg-white"
          }`}
        >
          Instagram
        </button>
        <button
          onClick={() => setTab("whatsapp")}
          className={`rounded px-4 py-2 text-sm border ${
            tab === "whatsapp" ? "bg-black text-white" : "bg-white"
          }`}
        >
          WhatsApp
        </button>
      </div>

      {tab !== "facebook" ? (
        tab === "instagram" ? (
          <div className="mt-6 rounded border p-6">
            <div className="text-lg font-semibold">Instagram</div>
            <p className="mt-2 text-gray-600">
              Connect Instagram → OAuth দিয়ে Pages/Assets আনুন → তারপর Page select করে Add করুন।
              (Instagram Messaging চালাতে Meta permissions/app review লাগতে পারে।)
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => connectOAuth("instagram")}
                className="rounded bg-black px-4 py-2 text-sm text-white"
              >
                Connect Instagram
              </button>
              <button
                onClick={() => listConnectedPages("instagram")}
                className="rounded border px-4 py-2 text-sm"
              >
                Refresh
              </button>
            </div>

            {oauthPages.length ? (
              <div className="mt-6 rounded border p-4">
                <div className="text-sm font-medium">Select a Page</div>
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">-- Select --</option>
                  {oauthPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
                <div className="mt-3">
                  <button
                    onClick={() => addSelectedPage("instagram")}
                    disabled={saving || !selectedPageId}
                    className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {saving ? "Adding..." : "Add Page"}
                  </button>
                </div>
              </div>
            ) : null}

            {connectedPages.length ? (
              <div className="mt-6 rounded border p-4 text-sm">
                <div className="font-medium">Connected Pages</div>
                <ul className="mt-2 list-disc pl-5">
                  {connectedPages
                    .filter((p) => p.platform === "instagram")
                    .map((p) => (
                      <li key={p.page_id}>
                        {p.page_name} <span className="text-gray-500">({p.page_id})</span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <div className="mt-6 text-sm text-gray-600">No connected pages yet.</div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded border p-6">
            <div className="text-lg font-semibold">WhatsApp</div>
            <p className="mt-2 text-gray-600">Coming soon.</p>
          </div>
        )
      ) : (
        <div className="mt-6 rounded border p-6">
          <div className="text-lg font-semibold">Facebook Page</div>
          {/* <p className="mt-2 text-gray-600">
            ✅ Recommended: Connect Facebook → OAuth দিয়ে Pages আনুন → Page select করে Add করুন।
            <br />
            (Legacy fallback: নিচের manual Page ID/Token form still available.)
          </p> */}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => connectOAuth("facebook")}
              className="rounded bg-black px-4 py-2 text-sm text-white"
            >
              Connect Facebook
            </button>
            <button
              onClick={() => listConnectedPages("facebook")}
              className="rounded border px-4 py-2 text-sm"
            >
              Refresh Connected
            </button>
          </div>

          {oauthPages.length ? (
            <div className="mt-6 rounded border p-4">
              <div className="text-sm font-medium">Select a Page</div>
              <select
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className="mt-2 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">-- Select --</option>
                {oauthPages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
              <div className="mt-3">
                <button
                  onClick={() => addSelectedPage("facebook")}
                  disabled={saving || !selectedPageId}
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Page"}
                </button>
              </div>
            </div>
          ) : null}

          {connectedPages.length ? (
            <div className="mt-6 rounded border p-4 text-sm">
              <div className="font-medium">Connected Pages</div>
              <ul className="mt-2 list-disc pl-5">
                {connectedPages
                  .filter((p) => p.platform === "facebook")
                  .map((p) => (
                    <li key={p.page_id}>
                      {p.page_name} <span className="text-gray-500">({p.page_id})</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="mt-6 text-sm text-gray-600">No connected pages yet.</div>
          )}

          <details className="mt-8 border-t pt-6">
            <summary className="cursor-pointer text-sm font-semibold select-none">
              Legacy Manual Setup (not recommended)
            </summary>
            <p className="mt-2 text-gray-600">
              OAuth না চললে fallback হিসেবে Page ID + Page Access Token দিয়ে save করতে পারবেন।
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Page ID</div>
              <input
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="e.g. 1234567890"
                className="mt-2 w-full rounded border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-sm font-medium">Page Access Token</div>
              <input
                value={pageToken}
                onChange={(e) => setPageToken(e.target.value)}
                placeholder="Paste token here"
                className="mt-2 w-full rounded border px-3 py-2 text-sm"
              />
            </div>

            </div>

            <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={saveFacebook}
              disabled={saving || !pageId.trim() || !pageToken.trim()}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={loadFacebook}
              disabled={loading}
              className="rounded border px-4 py-2 text-sm"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {err ? (
            <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}
          {ok ? (
            <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {ok}
            </div>
          ) : null}

            <div className="mt-6 rounded bg-gray-50 p-4 text-sm">
              <div className="font-medium">Current (server)</div>
              <div className="mt-2">
                <div>
                  <span className="text-gray-600">Source:</span> {current?.source || "-"}
                </div>
                <div>
                  <span className="text-gray-600">Page ID:</span> {current?.pageId || "-"}
                </div>
                <div>
                  <span className="text-gray-600">Token:</span> {current?.pageTokenMasked || "-"}
                </div>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
