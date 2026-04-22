import type { Metadata } from "next";
import "./globals.css";
import TabBar from "./components/TabBar";
import { AuthProvider } from "./lib/authContext";
import FontSizeProvider from "./components/FontSizeProvider";

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
    <html lang="en" className="h-full" data-theme="fantasy">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#5c1a5a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Expense Tracker" />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <FontSizeProvider>
          <AuthProvider>
            <div className="pb-16">{children}</div>
            <TabBar />
          </AuthProvider>
        </FontSizeProvider>
      </body>
    </html>
  );
}
