"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, RefreshCw, BarChart2, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function TabBar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const TABS = [
    { id: "reports",       href: "/reports",      Icon: BarChart2,  label: t("tabs.reports") },
    { id: "history",       href: "/history",      Icon: Clock,      label: t("tabs.history") },
    { id: "home",          href: "/",             Icon: Home,       label: t("tabs.home") },
    { id: "subscriptions", href: "/subscriptions",Icon: RefreshCw,  label: t("tabs.subscriptions") },
    { id: "settings",      href: "/settings",     Icon: Settings,   label: t("tabs.settings") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300">
      <div className="max-w-md mx-auto grid grid-cols-5 pt-1.5 pb-2">
        {TABS.map(tab => {
          const on = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <Link key={tab.id} href={tab.href}
              className="flex flex-col items-center gap-1">
              <span className={`grid place-items-center w-[54px] h-7 rounded-full transition-colors
                ${on ? "bg-primary text-primary-content" : "text-base-content/70"}`}>
                <tab.Icon size={20} strokeWidth={1.7} />
              </span>
              <span className={`text-[11px] font-medium ${on ? "text-base-content" : "text-base-content/50"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
