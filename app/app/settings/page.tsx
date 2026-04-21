import Link from "next/link";
export default function SettingsPage() {
  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-12">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
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
