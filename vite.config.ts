import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const browserUa =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function withHeaders(extra: Record<string, string>): ProxyOptions["configure"] {
  return (proxy) => {
    proxy.on("proxyReq", (proxyReq) => {
      proxyReq.setHeader("User-Agent", browserUa);
      proxyReq.setHeader("Accept", "application/json,text/plain,*/*");
      for (const [key, value] of Object.entries(extra)) {
        proxyReq.setHeader(key, value);
      }
    });
  };
}

const proxy: Record<string, ProxyOptions> = {
  "/live/yahoo": {
    target: "https://query1.finance.yahoo.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/live\/yahoo/, ""),
    configure: withHeaders({}),
  },
  "/live/mis": {
    target: "https://mis.twse.com.tw",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/live\/mis/, ""),
    configure: withHeaders({
      Referer: "https://mis.twse.com.tw/stock/fibest.jsp",
      Origin: "https://mis.twse.com.tw",
    }),
  },
};

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { proxy },
  preview: { proxy },
});
