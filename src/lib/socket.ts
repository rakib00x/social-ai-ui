let socket: any = null;

export const getSocket = () => {
  if (typeof window === "undefined") return null;

  if (!socket) {
    let token = "";
    let adminKey = "";

    try {
      const adminToken = localStorage.getItem("admin_token_v1") || "";
      const sellerToken = localStorage.getItem("seller_token_v1") || "";
      token = adminToken || sellerToken;
      adminKey = localStorage.getItem("social_ai_admin_key_v1") || "";
    } catch {
      // ignore
    }

    const mod: any = require("socket.io-client");
    const createIO = mod?.io || mod?.default || mod;

    socket = createIO(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
      transports: ["websocket"],
      auth: { token, adminKey }
    });
  }

  return socket;
};
