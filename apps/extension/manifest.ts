import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Faceless outliers",
  version: "0.1.0",
  action: { default_popup: "popup.html" },
  background: { service_worker: "src/background.ts", type: "module" },
  content_scripts: [
    {
      matches: ["https://studio.youtube.com/*"],
      js: ["src/content.ts"],
    },
  ],
  permissions: ["activeTab", "storage"],
  host_permissions: [
    "https://studio.youtube.com/*",
    "http://127.0.0.1:8787/*",
    "http://127.0.0.1:5173/*",
  ],
});
