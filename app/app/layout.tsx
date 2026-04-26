import type { Metadata } from "next";
import "./globals.css";
import TabBar from "./components/TabBar";
import AuthGuard from "./components/AuthGuard";
import { AuthProvider } from "./lib/authContext";
import FontSizeProvider from "./components/FontSizeProvider";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Personal expense tracking app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" data-theme="forest">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e6d4a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Expense Tracker" />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <FontSizeProvider>
          <Providers>
            <AuthProvider>
              <AuthGuard>
                <div className="pb-16">{children}</div>
                <TabBar />
              </AuthGuard>
            </AuthProvider>
          </Providers>
        </FontSizeProvider>
      </body>
    </html>
  );
}
