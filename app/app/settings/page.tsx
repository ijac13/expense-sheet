"use client";
import Link from "next/link";
import { DEFAULT_USER, USERS } from "../lib/users";

export default function SettingsPage() {
  const currentUser = USERS.find(u => u.id === DEFAULT_USER);
  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-12 pb-20">
      <h1 className="text-2xl font-semibold mb-1">Settings</h1>
      {currentUser && (
        <p className="text-sm text-base-content/50 mb-6">Signed in as <span className="font-medium text-base-content/70">{currentUser.name}</span></p>
      )}
      <div className="space-y-2">
        <Link href="/settings/categories" className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
          <span>Category Management</span>
          <span className="text-base-content/40">›</span>
        </Link>
        <Link href="/settings/users" className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
          <span>User Management</span>
          <span className="text-base-content/40">›</span>
        </Link>
        <div className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
          <span>Language</span>
          <span className="text-base-content/40">EN | 繁中</span>
        </div>
      </div>
    </main>
  );
}
