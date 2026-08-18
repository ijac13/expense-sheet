// Emails come from env so they stay out of the public repo. NEXT_PUBLIC_ is required:
// this app is a static export, so every read of USERS happens in the browser.
export const USERS = [
  { id: "user1", name: "ijac", email: process.env.NEXT_PUBLIC_USER1_EMAIL ?? "" },
  { id: "user2", name: "wei", email: process.env.NEXT_PUBLIC_USER2_EMAIL ?? "" },
] as const;

export type UserId = typeof USERS[number]["id"];

export const DEFAULT_USER: UserId = "user1";

export function getUserByEmail(email: string | null | undefined) {
  if (!email) return null;
  return USERS.find(u => u.email === email) ?? null;
}
