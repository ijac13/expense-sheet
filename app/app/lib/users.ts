export const USERS = [
  { id: "user1", name: "User 1", email: "" },
  { id: "user2", name: "User 2", email: "" },
] as const;

export type UserId = typeof USERS[number]["id"];

export const DEFAULT_USER: UserId = "user1";
