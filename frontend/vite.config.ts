import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180, // not 5173: that is where the Tomato food app lives on this machine
    strictPort: true,
    proxy: { "/api": "http://localhost:8000" },
  },
});
