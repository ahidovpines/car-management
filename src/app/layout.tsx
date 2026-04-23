import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ניהול רכבים | אביחי פינס סחר",
  description: "מערכת ניהול רכבים מיובאים",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "רכבים" },
  viewport: { width: "device-width", initialScale: 1, maximumScale: 1 },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
