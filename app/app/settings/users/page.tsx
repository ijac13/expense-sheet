"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/users`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<User[]>;
      })
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load users:", err);
        setError("Failed to load users");
        setLoading(false);
      });
  }, []);

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-20">
      <Link href="/settings" className="flex items-center gap-1 text-sm text-base-content/60 mb-4">
        <ChevronLeft size={16} /> Settings
      </Link>
      <h1 className="text-2xl font-semibold mb-1">User Management</h1>
      <p className="text-sm text-base-content/50 mb-6">
        Add or remove users by editing the Users tab in Google Sheets.
      </p>

      {loading && (
        <p className="text-sm text-base-content/50">Loading users...</p>
      )}

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {users.map(u => (
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
          {users.length === 0 && (
            <p className="text-sm text-base-content/50">No users found in the Users tab.</p>
          )}
        </div>
      )}
    </main>
  );
}
