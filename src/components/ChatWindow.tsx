// Customer inbox section

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LiveMsg } from "@/types/chat";

export default function ChatWindow({
  title,
  profilePic,
  messages,
  conversationId,
  forwardTargets,

  onBack,
  showBackOnMobile,
  onSent,
  isAdmin,
  sellers,
  assignedSellerId,
  deliveryStatus,
  onUpdateMeta,
}: {
  title: string;
  profilePic?: string;
  messages: LiveMsg[];
  conversationId: string | null;
  forwardTargets?: Array<{ conversationId: string; title: string; profilePic?: string }>;

  onBack?: () => void;
  showBackOnMobile?: boolean;
  onSent?: () => void;
  isAdmin?: boolean;
  sellers?: Array<{ _id?: string; id?: string; name?: string; firstName?: string; lastName?: string; email?: string }>;
  assignedSellerId?: string | null;
  deliveryStatus?: string | null;
  onUpdateMeta?: (conversationId: string, patch: { sellerId?: string | null; deliveryStatus?: string }) => void;
}) {
  // const API = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const API = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";


  const authHeaders = useMemo(() => {
    try {
      const adminToken = localStorage.getItem("admin_token_v1") || "";
      const adminKey = localStorage.getItem("social_ai_admin_key_v1") || "";
      const sellerToken = localStorage.getItem("seller_token_v1") || "";

      // ✅ Only use admin creds on admin panel
      if (isAdmin) {
        if (adminToken) return { Authorization: `Bearer ${adminToken}` };
        if (adminKey) return { "x-admin-key": adminKey };
      }

      // ✅ Seller panel uses seller token (even if an admin token exists in storage)
      if (sellerToken) return { Authorization: `Bearer ${sellerToken}` };
    } catch {
      // ignore
    }
    return {} as Record<string, string>;
  }, [isAdmin]);;

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [errMsg, setErrMsg] = useState<string>("");

  // ✅ Forward message (send an existing bubble to another conversation)
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<LiveMsg | null>(null);
  const [forwardTargetId, setForwardTargetId] = useState<string>("");
  const [forwardSending, setForwardSending] = useState(false);
  const [forwardError, setForwardError] = useState<string>("");

  // ✅ Media preview (lightbox)
  type PreviewItem = { url: string; type: 'image' | 'video' };
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const openPreview = (url: string, type: PreviewItem['type']) => setPreviewItem({ url, type });
  const closePreview = () => setPreviewItem(null);

  const openForward = (m: LiveMsg) => {
    setForwardError("");
    setForwardMsg(m);
    // preselect the first other conversation if available
    const first = (forwardTargets || []).find((x) => x?.conversationId && x.conversationId !== conversationId);
    setForwardTargetId(String(first?.conversationId || ""));
    setForwardOpen(true);
  };

  const doForward = async () => {
    if (!forwardMsg || !forwardTargetId) return;
    try {
      setForwardError("");
      setForwardSending(true);
      const res = await fetch(`${API}/api/social-ai-bot/forward-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ targetConversationId: forwardTargetId, message: forwardMsg.message || "" }),
      });
      if (!res.ok) {
        const t = await res.text();
        setForwardError(t || "Forward failed");
        return;
      }
      setForwardOpen(false);
      setForwardMsg(null);
      setForwardTargetId("");
    } catch (e: any) {
      setForwardError(e?.message || "Forward failed");
    } finally {
      setForwardSending(false);
    }
  };


  const listRef = useRef<HTMLDivElement | null>(null);

  // ✅ Extract ALL URLs from message text
  const extractAllUrls = (t: string) => {
    if (!t) return [];

    // Clean up URLs that come with quotes, commas, brackets, etc.
    // This commonly happens when URLs are joined with punctuation or stored as JSON-like arrays.
    const sanitizeUrl = (u: string) =>
      String(u || "")
        .trim()
        // leading wrappers
        .replace(/^["'\(\[]+/, "")
        // trailing wrappers/punctuation (comma, quote, bracket, paren, dot)
        .replace(/[\]\)"',\.]+$/, "");

    // Some payloads join multiple URLs with commas (no spaces). Split them.
    const splitAndSanitizeUrls = (s: string) =>
      String(s || "")
        .split(",")
        .map((x) => sanitizeUrl(x))
        .filter(Boolean);
    
    // Handle "📷 Images:" format
    if (t.startsWith("📷 Images:")) {
      return t
        .split("\n")
        .slice(1)
        .flatMap((s) => splitAndSanitizeUrls(s));
    }
    
    // Handle "📷 Image:" format
    if (t.includes("📷 Image:")) {
      const part = t.split("📷 Image:")[1]?.trim() || "";
      return splitAndSanitizeUrls(part);
    }
    
    // Handle "🎥 Video:" format
    if (t.startsWith("🎥 Video:")) {
      const part = t.split("🎥 Video:")[1]?.trim() || "";
      return splitAndSanitizeUrls(part);
    }

    // Handle "🎥 Videos:" format (multiple videos in one bubble)
    if (t.startsWith("🎥 Videos:")) {
      return t
        .split("\n")
        .slice(1)
        .flatMap((s) => splitAndSanitizeUrls(s));
    }

    // Handle "📎 Attachments:" format (mixed media in one bubble)
    if (t.startsWith("📎 Attachments:")) {
      return t
        .split("\n")
        .slice(1)
        .flatMap((s) => splitAndSanitizeUrls(s));
    }
    
    // Extract all absolute URLs and our relative uploads paths from text
    // - absolute: https?://...
    // - relative: /uploads/...
    const matches = t.match(/(https?:\/\/\S+|\/uploads\/[^\s]+)/g);
    return (matches || []).flatMap((x) => splitAndSanitizeUrls(x));
  };

  // Normalize media URLs so the panel can fetch them reliably.
  // If a message stores a relative `/uploads/...`, we fetch from backend API base.
  const normalizeMediaUrl = (url: string) => {
    if (!url) return url;

    // Relative uploads -> keep relative so Next.js can proxy `/uploads/*` via rewrites
    if (url.startsWith('/uploads/')) {
      return url;
    }

    // If someone accidentally stored UI-origin uploads URLs, swap to API base.
    // (common when UI is exposed via ngrok on :3000 but backend is :5000)
    try {
      const u = new URL(url);
      const api = new URL(API);
      if (u.pathname.startsWith('/uploads/') && u.origin === window.location.origin && api.origin !== u.origin) {
        // Swap to relative to allow Next rewrite/proxy
        return `${u.pathname}${u.search}`;
      }
    } catch {
      // ignore
    }

    return url;
  };

  // ✅ Check if URL is probably an image
  const isProbablyImageUrl = (url: string) => {
    if (!url) return false;

    // fb/ig cdn
    if (url.includes("fbcdn.net") || url.includes("scontent")) return true;

    // our uploads (ngrok/local)
    if (url.includes("/uploads/")) return true;

    // normal extensions
    return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
  };

  // ✅ Check if URL is probably a video
  const isProbablyVideoUrl = (url: string) => {
    if (!url) return false;
    return /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url);
  };

  // ✅ Separate URLs into media items with type
  const categorizeMediaUrls = (t: string) => {
    const urls = extractAllUrls(t);
    const media: Array<{ url: string; type: 'image' | 'video' }> = [];

    urls.forEach((url) => {
      const fixedUrl = normalizeMediaUrl(url);
      if (isProbablyVideoUrl(fixedUrl)) {
        media.push({ url: fixedUrl, type: 'video' });
      } else if (isProbablyImageUrl(fixedUrl)) {
        media.push({ url: fixedUrl, type: 'image' });
      }
    });

    return media;
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSendText = async () => {
    const msg = text.trim();
    if (!msg || !conversationId) return;

    try {
      setErrMsg("");
      setSending(true);

      const res = await fetch(`${API}/api/social-ai-bot/manual-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ conversationId, message: msg }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("manual-reply failed:", t);
        setErrMsg(t || "Send failed");
        return;
      }

      setText("");
      onSent?.();
    } catch (e: any) {
      console.error(e);
      setErrMsg(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async () => {
    if (!conversationId || files.length === 0) return;

    try {
      setErrMsg("");
      setSending(true);

      const form = new FormData();
      form.append("conversationId", conversationId);

      // ✅ multiple append
      files.forEach((f) => form.append("files", f));

      const res = await fetch(`${API}/api/social-ai-bot/manual-media-reply`, {
        method: "POST",
        headers: { ...authHeaders },
        body: form,
      });

      const body = await res.text();
      if (!res.ok) {
        console.error("manual-media-reply failed:", body);
        setErrMsg(body || "Media send failed");
        return;
      }

      setFiles([]);
      onSent?.();
    } catch (e: any) {
      console.error(e);
      setErrMsg(e?.message || "Media send failed");
    } finally {
      setSending(false);
    }
  };

  const smartSend = () => {
    if (sending) return;
    if (files.length > 0) return handleSendMedia();
    return handleSendText();
  };

  const headerId = useMemo(() => conversationId || "", [conversationId]);

  const sellerLabel = (s: any) => {
    const full = [s?.firstName, s?.lastName].filter(Boolean).join(" ").trim();
    return full || s?.name || s?.email || "Seller";
  };

  const assignedSellerName = (sellerId?: string | null) => {
    if (!sellerId) return "Unassigned";
    const s = (sellers || []).find((x) => String(x?._id || x?.id) === String(sellerId));
    return s ? sellerLabel(s) : "Seller";
  };

  const statusLabel = (v?: string | null) => {
    const x = String(v || 'confirmed');
    if (x === 'delivered') return 'delivered';
    if (x === 'cancel') return 'cancel';
    return x;
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Customer ID show Header */}
      <div className="border-b border-[#000000]">


        {/* This code for ui comment 
        <p className="text-[#adadad] truncate">This section code path is--social-ai-ui/src/ChatWindow.tsx</p>
        */}


        <div className="px-4 py-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              {profilePic ? (
                <img src={profilePic} alt={title || "Customer"} className="w-full h-full object-cover" />
              ) : null}
            </div>
              <div className="text-[#1a070d] font-semibold text-xl truncate">
                {title || headerId}
              </div>
            </div>

            {/* ✅ Admin-only: Actions menu moved to inbox header (next to customer name) */}
            {isAdmin && conversationId ? (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <select
                  className={[
                    "h-10 min-w-[160px] rounded-md bg-white px-2 text-xs",
                    "border border-gray-300 shadow-sm",
                    "focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400",
                  ].join(" ")}
                  value=""
                  onChange={(e) => {
                    const v = String(e.target.value || "");
                    (e.target as HTMLSelectElement).value = "";

                    if (!v) return;
                    if (v === "unassign") {
                      onUpdateMeta?.(conversationId, { sellerId: null });
                      return;
                    }
                    if (v.startsWith("assign:")) {
                      const id = v.slice("assign:".length);
                      onUpdateMeta?.(conversationId, { sellerId: id || null });
                      return;
                    }
                  }}
                >
                  <option key="placeholder" value="">
                    Actions…
                  </option>

                  {(sellers || [])
                    .map((s: any, idx: number) => ({ s, idx, sid: String(s?._id || s?.id || "") }))
                    .filter((x) => !!x.sid)
                    .map(({ s, idx, sid }) => (
                      <option key={`assign-${sid}-${idx}`} value={`assign:${sid}`}>
                        Assign : {sellerLabel(s)}
                      </option>
                    ))}

                  <option key="unassign" value="unassign">
                    Unassign ({assignedSellerName(assignedSellerId)})
                  </option>
                </select>
              </div>
            ) : null}

            {/* ✅ Seller-only: Status menu moved to inbox header (next to customer name) */}
            {!isAdmin && conversationId ? (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <select
                  className={[
                    "h-10 min-w-[160px] rounded-md bg-white px-2 text-xs",
                    "border border-gray-300 shadow-sm",
                    "focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400",
                  ].join(" ")}
                  value=""
                  onChange={(e) => {
                    const v = String(e.target.value || "");
                    (e.target as HTMLSelectElement).value = "";
                    if (!v) return;
                    if (v.startsWith("status:")) {
                      const st = v.slice("status:".length);
                      onUpdateMeta?.(conversationId, { deliveryStatus: st });
                    }
                  }}
                >
                  <option key="placeholder" value="">
                    Status ({statusLabel(deliveryStatus)})
                  </option>
                  <option key="status-confirmed" value="status:confirmed">confirmed</option>
                  <option key="status-hold" value="status:hold">hold</option>
                  <option key="status-delivered" value="status:delivered">delivered</option>
                  <option key="status-cancel" value="status:cancel">cancel</option>
                </select>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      

      

      {/* ✅ Media preview modal */}
      {previewItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={() => closePreview()}
        >
          <div
            className="relative w-full max-w-5xl rounded-2xl bg-white border-2 border-black p-3"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-2 right-2 px-3 py-1 rounded-lg border border-black bg-white text-sm hover:bg-gray-100"
              onClick={() => closePreview()}
            >
              Close
            </button>

            <div className="w-full flex items-center justify-center">
              {previewItem.type === 'video' ? (
                <video
                  src={previewItem.url}
                  controls
                  className="max-h-[80vh] w-auto max-w-[92vw] rounded-xl border border-black object-contain"
                />
              ) : (
                <img
                  src={previewItem.url}
                  alt="preview"
                  className="max-h-[80vh] w-auto max-w-[92vw] rounded-xl border border-black object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ Forward modal */}
      {forwardOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={() => {
            if (!forwardSending) {
              setForwardOpen(false);
              setForwardMsg(null);
              setForwardTargetId("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white border-2 border-black p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-2">Forward message</div>

            <div className="text-xs text-gray-600 mb-3 whitespace-pre-wrap max-h-24 overflow-auto border border-gray-200 rounded-md p-2">
              {forwardMsg?.message || ""}
            </div>

            <label className="block text-sm font-medium mb-1">Send to</label>
            <select
              className="w-full h-10 rounded-md border border-gray-300 px-2 text-sm"
              value={forwardTargetId}
              onChange={(e) => setForwardTargetId(String(e.target.value || ""))}
              disabled={forwardSending}
            >
              {(forwardTargets || [])
                .filter((x) => x?.conversationId && x.conversationId !== conversationId)
                .map((x) => (
                  <option key={x.conversationId} value={x.conversationId}>
                    {x.title || x.conversationId}
                  </option>
                ))}
            </select>

            {forwardError ? <div className="mt-2 text-sm text-red-600 whitespace-pre-wrap">{forwardError}</div> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-10 px-4 rounded-md border border-gray-300"
                onClick={() => {
                  setForwardOpen(false);
                  setForwardMsg(null);
                  setForwardTargetId("");
                }}
                disabled={forwardSending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-md bg-black text-white disabled:opacity-60"
                onClick={doForward}
                disabled={forwardSending || !forwardTargetId || !forwardMsg}
              >
                {forwardSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Customer Messages Box */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-auto px-4 py-4 md:px-8 md:py-6">
        <div className="space-y-6">
          {messages.map((m, idx) => {
            const isBot = m.sender === "bot";
            const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";

            const senderLabel = (() => {
              if (!isBot) {
                return (m.senderName || m.customerName || title || "Customer").trim();
              }

              // Prefer explicit senderName from backend for admin/seller messages.
              if (m.senderName) return String(m.senderName).trim();

              // Backward compatible fallback for old rows
              if (m.senderRole === "admin") return "Admin";
              if (m.senderRole === "seller") return "Seller";
              if (m.senderRole === "ai") return "AI Bot";

              // Legacy behavior: bot messages in admin panel were labelled "admin".
              return isAdmin ? "Admin" : "Seller";
            })();

            // ✅ Get all media items (images and videos mixed)
            const media = categorizeMediaUrls(m.message || "");
            const hasMedia = media.length > 0;

            // ✅ Extract text without media markers
            let displayText = m.message || "";
            if (
              displayText.startsWith("📷 Images:") ||
              displayText.startsWith("🎥 Video:") ||
              displayText.startsWith("🎥 Videos:") ||
              displayText.startsWith("📎 Attachments:")
            ) {
              displayText = ""; // Don't show the marker text
            } else if (displayText.includes("📷 Image:")) {
              displayText = displayText.split("📷 Image:")[0]?.trim() || "";
            }

            // ✅ If the message mostly contains media URLs (common for forwarded media),
            // hide the raw URL text and only show the media preview grid.
            if (hasMedia && displayText) {
              const urls = extractAllUrls(displayText);
              if (urls.length > 0) {
                let stripped = displayText;
                urls.forEach((u) => {
                  // Remove both raw and normalized variants if present
                  stripped = stripped.split(u).join("");
                });
                // Remove leftover punctuation/labels/newlines
                stripped = stripped
                  .replace(/\bhttps?:\/\/\S+\b/g, "")
                  .replace(/\(\s*\)/g, "")
                  .replace(/[\s\n\r\t]+/g, " ")
                  .replace(/[:\-–—•]+/g, " ")
                  .trim();

                if (!stripped) {
                  displayText = "";
                } else {
                  displayText = stripped;
                }
              }
            }

            return (
              <div
                key={`${m.timestamp}-${idx}`}
                className={["w-full flex", isBot ? "justify-end" : "justify-start"].join(" ")}
              >
                <div
                  className={[
                    "max-w-[780px] px-5 py-4 text-sm leading-relaxed",
                    "border-2 border-black rounded-xl bg-white",
                    "transition-colors duration-150 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="text-[12px] font-medium">{senderLabel}</div>
                    <div className="flex items-center gap-3">
                      {conversationId && (forwardTargets || []).length > 1 ? (
                        <button
                          type="button"
                          className="text-[11px] underline text-gray-700 hover:text-black"
                          onClick={() => openForward(m)}
                        >
                          forward
                        </button>
                      ) : null}
                      <div className="text-[11px] text-gray-500">{time}</div>
                    </div>
                  </div>

                  {/* ✅ Display text if available */}
                  {displayText && (
                    <div className="whitespace-pre-wrap mb-3">{displayText}</div>
                  )}

                  {/* ✅ Display all media (images and videos) in same grid */}
                  {media.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {media.map((item, i) => (
                        <div key={`${item.url}-${i}`} className="w-full">
                          {item.type === 'video' ? (
                            <div className="w-full">
                              <video
                                src={item.url}
                                controls
                                className="w-full max-h-64 rounded-lg border border-black object-contain bg-white"
                              />
                              <button
                                type="button"
                                className="mt-1 text-[11px] underline text-gray-700 hover:text-black"
                                onClick={() => openPreview(item.url, 'video')}
                              >
                                preview
                              </button>
                            </div>
                          ) : (
                            <img
                              src={item.url}
                              alt={`attachment-${i + 1}`}
                              className="w-full max-h-64 rounded-lg border border-black object-contain bg-white cursor-zoom-in"
                              onClick={() => openPreview(item.url, 'image')}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ✅ If no media and no display text, show original message */}
                  {!hasMedia && !displayText && (
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="w-full border-t-2 border-black" />

      {/* Bottom pill input (like screenshot) */}
      <div className="px-4 md:px-16 pb-4 md:pb-6">
        <div className="bg-[#2b2b2b] rounded-full px-4 py-3 flex items-center gap-3 shadow-inner">
          {/* hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            disabled={!conversationId || sending}
          />

          {/* + */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!conversationId || sending}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl hover:bg-[#3a3a3a] disabled:opacity-50"
            title="Attach"
          >
            +
          </button>

          {/* input */}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") smartSend();
            }}
            placeholder={files.length ? `selected: ${files.length} file(s)` : "type your message"}
            disabled={!conversationId || sending}
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-400 text-base"
          />

          {/* send */}
          <button
            type="button"
            onClick={smartSend}
            disabled={!conversationId || sending || (!text.trim() && files.length === 0)}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
            title="Send"
          >
            ↑
          </button>
        </div>

        {/* file + error */}
        {files.length > 0 && (
          <div className="mt-2 text-sm text-gray-400">
            Selected: <span className="font-medium">{files.length} file(s)</span>
            <button type="button" className="ml-2 underline" onClick={() => setFiles([])}>
              remove
            </button>
          </div>
        )}

        {errMsg && (
          <div className="mt-2 text-sm text-red-600">
            {errMsg}
          </div>
        )}
      </div>
    </div>
  );
}