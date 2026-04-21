"use client";
import { getFirebaseAuth } from "./firebase";
import { GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged, User } from "firebase/auth";

export const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithRedirect(getFirebaseAuth(), googleProvider);
}

export function signOutUser() {
  return signOut(getFirebaseAuth());
}

// Stub: check if email is authorized
// Real check reads Users tab via Firebase Function — deferred to integration phase
const AUTHORIZED_EMAILS_STUB = ["ijac.wei@gmail.com"]; // captain's email

export function isAuthorizedEmail(email: string): boolean {
  // In production, this check happens server-side via Firebase Function
  // For now, allow any signed-in user (open stub) so preview works
  return true;
}

export { onAuthStateChanged, type User };
