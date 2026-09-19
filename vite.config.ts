import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/; the deploy workflow sets BASE_PATH accordingly.
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
      manifest: {
        name: "Pace Practice",
        short_name: "Pace Practice",
        description: "Teleprompter for rehearsing timed talks",
        theme_color: "#0b0d10",
        background_color: "#0b0d10",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
