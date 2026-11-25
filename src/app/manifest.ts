import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "设备管理 · 月立集团",
    short_name: "设备管理",
    description: "设备台账、扫码报修、维修工单与巡检保养。",
    start_url: "/app/dashboard",
    display: "standalone",
    background_color: "#f5f4f0",
    theme_color: "#243844",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
