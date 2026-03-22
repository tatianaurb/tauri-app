import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


const devHost = "192.168.0.134";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: devHost,
    hmr: {
      protocol: "ws",
      host: devHost,
      port: 1421, 
      clientPort: 1421 
    },
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  }
});
