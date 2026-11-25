import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "设备管理 · 月立集团",
    template: "%s · 设备管理",
  },
  description: "设备台账、扫码报修、维修工单与巡检保养的一体化平台。",
  applicationName: "设备管理",
  appleWebApp: {
    capable: true,
    title: "设备管理",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#243844",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* 首屏渲染前恢复侧边栏偏好，避免展开后再收起的闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("cmms:sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}',
          }}
        />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
