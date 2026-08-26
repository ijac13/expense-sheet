"use client";
import { getFirebaseAuth } from "./firebase";

/**
 * Thrown instead of issuing a tokenless request. Every page renders behind
 * AuthGuard, so this is a guard against a future caller reaching the API before
 * sign-in resolves — not a path the app takes today. It is a named class so a
 * caller can tell "you are not signed in" apart from a real API failure.
 */
export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in: no Firebase user to mint an ID token from");
    this.name = "NotSignedInError";
  }
}

/**
 * The single door to the API. Every call carries the signed-in user's Firebase
 * ID token, which the `api` Cloud Function verifies and matches against its
 * authorized-email list. getIdToken() serves a cached token and refreshes it
 * automatically within five minutes of expiry, so this is not a network round
 * trip per call.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new NotSignedInError();

  const token = await user.getIdToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
