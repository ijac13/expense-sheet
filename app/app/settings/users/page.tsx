"use client";
import { useAuth } from "../../lib/authContext";

export default function UsersPage() {
  const { user, signOut } = useAuth();
  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-12 pb-20">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      <p className="text-sm text-base-content/50 mb-4">
        Users are managed directly in the Google Sheet.
      </p>
      {user && (
        <div className="p-4 bg-base-200 rounded-xl mb-4">
          <div className="font-medium">{user.displayName ?? "User"}</div>
          <div className="text-sm text-base-content/50">{user.email}</div>
        </div>
      )}
      <button onClick={signOut} className="btn btn-ghost btn-sm w-fit">Sign out</button>
    </main>
  );
}
