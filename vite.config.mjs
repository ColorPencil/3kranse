import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createGuestbookHandler, guestbookConfig } from './server/guestbook.mjs';
import { toWebRequest, sendWebResponse } from './server/node-adapter.mjs';
import { clientIP } from './server/client-ip.mjs';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        // The expanded codex changes independently from the page shell and can be cached separately.
        manualChunks(id) {
          if (id.includes('/src/generated/catalogue.json')) return 'catalogue';
          if (id.includes('/node_modules/') && /react|scheduler/.test(id)) return 'ui-runtime';
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), {
    name: 'guestbook-adapter',
    configureServer(server) {
      const api = createGuestbookHandler(guestbookConfig({ ...process.env, ...loadEnv(mode, process.cwd(), '') }));
      server.middlewares.use('/api/guestbook', async (req, res) => {
        // Connect strips the mount path; restore it for the shared production handler.
        req.url = '/api/guestbook' + req.url;
        await sendWebResponse(res, await api(toWebRequest(req), { ip: clientIP(req) }));
      });
    },
  }],
}));
