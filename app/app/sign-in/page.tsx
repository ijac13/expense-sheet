"use client";
import { useAuth } from "../lib/authContext";
export default function SignInPage() {
  const { signIn } = useAuth();
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-base-100 px-6 gap-8">
      <div className="text-center">
        <div className="text-5xl mb-4">💰</div>
        <h1 className="text-2xl font-bold">Expense Tracker</h1>
        <p className="text-base-content/60 mt-2">Household spending, tracked together.</p>
      </div>
      <button onClick={signIn} className="btn btn-primary btn-lg w-full max-w-xs gap-2">
        <span>Sign in with Google</span>
      </button>
    </main>
  );
}
