import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "MCP Monitor - Dashboard",
  description: "Real-time monitoring of AI context bridges",
};

import { WebSocketProvider } from "@/providers/WebSocketProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#050505] text-gray-200 font-sans h-screen overflow-hidden flex">
        <WebSocketProvider>
          {/* Background glow effect */}
          <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none z-0"></div>

          <Sidebar />

          <main className="flex-1 overflow-hidden relative z-10 flex flex-col">{children}</main>
        </WebSocketProvider>
      </body>
    </html>
  );
}
