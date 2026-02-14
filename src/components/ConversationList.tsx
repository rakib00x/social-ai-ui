// Customers list (ConversationList)
"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Item = {
  conversationId: string;
  customerName: string;
  customerProfilePic?: string;
  platform: string;
  lastMessage: string;
  lastTime: string;
  assignedSellerId?: string | null;
  deliveryStatus?: string | null;
  unreadCount?: number;
  isUnread?: boolean;
  pulse?: boolean;
  seen?: boolean;
  isSeen?: boolean;
};

function initialsFromName(name: string | undefined | null): string {
  const n = (name || "").trim();
  if (!n) return "CU";
  const parts = n.split(/\s+/).filter(Boolean);
  const takeChar = (s: string) => Array.from(s)[0] || "";
  if (parts.length >= 2) return (takeChar(parts[0]) + takeChar(parts[1])).toUpperCase();
  const chars = Array.from(parts[0]);
  return (chars.slice(0, 2).join("") || "CU").toUpperCase();
}


export default function ConversationList({
  items,
  activeId,
  onSelect,
  isAdmin,
  sellers,
  onUpdateMeta,
}: {
  items: Item[];
  activeId: string | null;
  onSelect: (id: string) => void;
  isAdmin?: boolean;
  sellers?: Array<{ _id?: string; id?: string; name?: string; firstName?: string; lastName?: string; email?: string }>;
  onUpdateMeta?: (conversationId: string, patch: { sellerId?: string | null; deliveryStatus?: string }) => void;
}) {
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return (items || []).filter((c) => {
      const name = String(c.customerName || "").toLowerCase();
      return name.includes(q);
    });
  }, [items, query]);

  const sellerLabel = (s: any) => {
    const full = [s?.firstName, s?.lastName].filter(Boolean).join(" ").trim();
    return full || s?.name || s?.email || "Seller";
  };

  const assignedSellerName = (sellerId?: string | null) => {
    if (!sellerId) return "Unassign";
    const s = (sellers || []).find((x) => String(x._id || x.id) === String(sellerId));
    return s ? sellerLabel(s) : "Seller";
  };

  const statusLabel = (v?: string | null) => {
    const x = String(v || "confirmed");
    if (x === "delivered") return "delevered";
    if (x === "cancel") return "cancle";
    return x;
  };

  const normalizeStatus = (v?: string | null) => {
    const x = String(v || "confirmed").trim().toLowerCase();
    // Be tolerant to common typos / variants
    if (x === "cancle" || x === "cancelled") return "cancel";
    if (x === "delevered") return "delivered";
    if (x === "onhold" || x === "on_hold" || x === "on-hold") return "hold";
    
    return x;
  };

  const statusChipStyle = (v?: string | null): CSSProperties => {
    const x = normalizeStatus(v);

    // Use inline styles so Tailwind class-purging / JIT issues can't break colors.
    // cancel -> red, hold -> yellow, delivered -> green, confirmed -> blue
    if (x === "cancel") {
      return { backgroundColor: "#FEF2F2", color: "#B91C1C", borderColor: "#FCA5A5" };
    }
    if (x === "hold") {
      return { backgroundColor: "#FFFBEB", color: "#92400E", borderColor: "#FCD34D" };
    }
    if (x === "delivered") {
      return { backgroundColor: "#ECFDF5", color: "#047857", borderColor: "#6EE7B7" };
    }
    // confirmed (default)
    return { backgroundColor: "#EFF6FF", color: "#1D4ED8", borderColor: "#93C5FD" };
  };

  const hasUnread = (c: Item) => {
    // Prefer explicit seen flags if present
    if (typeof (c as any).seen === "boolean") return !(c as any).seen;
    if (typeof (c as any).isSeen === "boolean") return !(c as any).isSeen;

    // Backend unreadCount only counts customer messages. In UI, be tolerant to either field.
    if (typeof c.unreadCount === "number") return c.unreadCount > 0;
    return Boolean(c.isUnread);
  };

  const UnreadDot = ({ show, pulse }: { show: boolean; pulse?: boolean }) => {
    // IMPORTANT:
    // - Keep a fixed-size container always mounted so the layout never shifts.
    // - Use inline styles for visibility so the dot reliably hides even if Tailwind
    //   class generation/purging ever misses opacity utilities.
    return (
      <span
        aria-label={pulse ? "New unread" : "Unread"}
        aria-hidden={!show}
        className="inline-flex w-3 shrink-0 items-center justify-center select-none"
      >
        <span
          className={[pulse && show ? "animate-pulse" : "", "text-sm leading-5"].join(" ")}
          style={{
            opacity: show ? 1 : 0,
            transition: "opacity 200ms",
            color: "#3B82F6", // tailwind blue-500
          }}
        >
          ⏺
        </span>
      </span>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-gray-900 font-semibold text-base">Customers</h2>

        {/* Search */}
        <div className="mt-3">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by customer name…"
              className={[
                "w-full h-10 rounded-md bg-white pl-3 pr-9 text-sm",
                "border border-gray-300 shadow-sm",
                "placeholder:text-gray-400",
                "focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400",
              ].join(" ")}
            />

            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Result count (only show while filtering) */}
          {query.trim() ? (
            <div className="mt-2 text-[11px] text-gray-500">
              Showing {filteredItems.length} of {items.length}
            </div>
          ) : null}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {filteredItems.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">No customers found.</div>
        ) : null}

        {filteredItems.map((c) => {
          const isActive = c.conversationId === activeId;

          return (
            <button
              key={c.conversationId}
              onClick={() => onSelect(c.conversationId)}
              className={[
                "chat-anim-fade-in",
                "group w-full text-left px-4 py-3 border-b border-gray-100 transition",
                "hover:bg-gray-50",
                isActive ? "bg-gray-50 border-l-2 border-l-gray-900" : "bg-white border-l-2 border-l-transparent",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={[
                    "w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden relative",
                    isActive ? "ring-2 ring-gray-900/10" : "ring-1 ring-gray-900/5",
                  ].join(" ")}
                >
                  {c.customerProfilePic ? (
                    <img
                      src={c.customerProfilePic}
                      alt={c.customerName || "Customer"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-700 select-none">
                      {initialsFromName(c.customerName)}
                    </span>
                  )}
</div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Row 1: Name / (Seller: Status update) */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      {/* Customer name (bold when unread) + unread indicator dot on the right */}
                      <span
                        className={["min-w-0 truncate text-sm leading-5 text-gray-900", hasUnread(c) ? "font-bold" : "font-normal"].join(" ")}
                        title={c.customerName || c.conversationId}
                      >
                        {c.customerName || c.conversationId}
                      </span>
                      <UnreadDot show={hasUnread(c)} pulse={c.pulse} />
</div>

                    {/* Seller status menu moved to inbox header (ChatWindow) */}
                    {null}
                  </div>

                  {/* Row 2: Message + Time (both) */}
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className={["min-w-0 truncate text-xs", hasUnread(c) ? "text-gray-900 font-medium" : "text-gray-600"].join(" ")} title={c.lastMessage}>
                      {c.lastMessage}
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-[11px] text-gray-400">
                      <div className="flex items-center gap-2">
                        <span>{new Date(c.lastTime).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Meta chips */}
                  {isAdmin ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                        <span className="text-gray-500">Seller:</span>
                        <span className="truncate max-w-[160px]" title={assignedSellerName(c.assignedSellerId)}>
                          {assignedSellerName(c.assignedSellerId)}
                        </span>
                      </span>

                      <span
                        style={statusChipStyle(c.deliveryStatus)}
                        className={[
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border",
                          
                        ].join(" ")}
                      >
                        <span className="text-gray-500">Status:</span>
                        <span>{statusLabel(c.deliveryStatus)}</span>
                      </span>

                      <span className="inline-flex items-center rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                        {String(c.platform || "").toLowerCase()}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        style={statusChipStyle(c.deliveryStatus)}
                        className={[
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border",
                          
                        ].join(" ")}
                      >
                        <span className="text-gray-500">Status:</span>
                        <span>{statusLabel(c.deliveryStatus)}</span>
                      </span>

                      <span className="inline-flex items-center rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                        {String(c.platform || "").toLowerCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}