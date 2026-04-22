"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, RefreshCw, BarChart2, Settings } from "lucide-react";

const TABS = [
  { id: "reports",       href: "/reports",      Icon: BarChart2,  label: "Reports" },
  { id: "history",       href: "/history",      Icon: Clock,      label: "History" },
  { id: "home",          href: "/",             Icon: Home,       label: "Home" },
  { id: "subscriptions", href: "/subscriptions",Icon: RefreshCw,  label: "Recurring" },
  { id: "settings",      href: "/settings",     Icon: Settings,   label: "Settings" },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300">
      <div className="max-w-md mx-auto grid grid-cols-5 pt-1.5 pb-2">
        {TABS.map(t => {
          const on = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          return (
            <Link key={t.id} href={t.href}
              className="flex flex-col items-center gap-1">
              <span className={`grid place-items-center w-[54px] h-7 rounded-full transition-colors
                ${on ? "bg-primary text-primary-content" : "text-base-content/70"}`}>
                <t.Icon size={20} strokeWidth={1.7} />
              </span>
              <span className={`text-[11px] font-medium ${on ? "text-base-content" : "text-base-content/50"}`}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
