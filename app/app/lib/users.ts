export const USERS = [
  { id: "user1", name: "ijac", email: "ijac.wei@gmail.com" },
  { id: "user2", name: "wei", email: "wei7780@gmail.com" },
] as const;

export type UserId = typeof USERS[number]["id"];

export const DEFAULT_USER: UserId = "user1";

export function getUserByEmail(email: string | null | undefined) {
  if (!email) return null;
  return USERS.find(u => u.email === email) ?? null;
}
