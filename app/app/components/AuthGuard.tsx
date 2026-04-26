"use client";
import { useAuth } from "../lib/authContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn, unauthorizedEmail } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (unauthorizedEmail) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-base-100 px-6 gap-8">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-base-content/60 mt-2">This account isn't authorized to use this app.</p>
        </div>
        <button onClick={signIn} className="btn btn-outline btn-sm">
          Try a different account
        </button>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-base-100 px-6 gap-8">
        <div className="text-center">
          <div className="text-5xl mb-4">💰</div>
          <h1 className="text-2xl font-bold">Expense Tracker</h1>
          <p className="text-base-content/60 mt-2">Household spending, tracked together.</p>
        </div>
        <button onClick={signIn} className="btn btn-primary btn-lg w-full max-w-xs gap-2">
          Sign in with Google
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
