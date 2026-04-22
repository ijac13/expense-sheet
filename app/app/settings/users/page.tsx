"use client";
import { USERS } from "../../lib/users";

export default function UsersPage() {
  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-20">
      <h1 className="text-2xl font-semibold mb-1">User Management</h1>
      <p className="text-sm text-base-content/50 mb-6">
        Add or remove users by editing the Users tab in Google Sheets.
      </p>

      <div className="space-y-2">
        {USERS.map(u => (
          <div key={u.id} className="flex items-center gap-3 p-4 bg-base-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/20 grid place-items-center text-primary font-semibold text-sm shrink-0">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-sm text-base-content/50">{u.email || "No email set"}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-base-content/40 mt-6">
        Showing stub users. Real names and emails will load from Google Sheets once auth is connected.
      </p>
    </main>
  );
}
