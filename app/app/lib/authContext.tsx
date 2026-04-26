"use client";
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getUserByEmail, type UserId } from "./users";

const googleProvider = new GoogleAuthProvider();

interface AuthContextType {
  user: User | null;
  loading: boolean;
  resolvedUserId: UserId | null;
  unauthorizedEmail: boolean;
  signIn: () => void;
  signOut: () => void;
  hasReauthed: boolean;
  setHasReauthed: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const INACTIVITY_MS = 60_000; // 1 minute

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<UserId | null>(null);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState(false);
  const [hasReauthed, setHasReauthed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      signOut(getFirebaseAuth());
      setHasReauthed(false);
    }, INACTIVITY_MS);
  }

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        const resolved = getUserByEmail(u.email);
        if (resolved) {
          setUser(u);
          setResolvedUserId(resolved.id);
          setUnauthorizedEmail(false);
          resetTimer();
        } else {
          signOut(auth);
          setUser(null);
          setResolvedUserId(null);
          setUnauthorizedEmail(true);
        }
      } else {
        setUser(null);
        setResolvedUserId(null);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
      setLoading(false);
    });
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ["click", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, resetTimer));
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      resolvedUserId,
      unauthorizedEmail,
      signIn: () => { setUnauthorizedEmail(false); signInWithPopup(getFirebaseAuth(), googleProvider); },
      signOut: () => { signOut(getFirebaseAuth()); setHasReauthed(false); setUnauthorizedEmail(false); },
      hasReauthed,
      setHasReauthed,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
