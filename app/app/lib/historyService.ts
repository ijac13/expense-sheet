import { Expense } from "./expenses";

// Generate rich mock history data spanning 7 days and 2 users
export function getAllExpenses(): Expense[] {
  const today = new Date();
  const d = (daysAgo: number): string => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split("T")[0];
  };

  return [
    { id: "h1",  date: d(0), amount: 450,  category_id: "eating-out",       paid_by: "user1", created_by: "user1", created_at: new Date().toISOString(), notes: "Lunch" },
    { id: "h2",  date: d(0), amount: 1200, category_id: "transportation",   paid_by: "user2", created_by: "user2", created_at: new Date().toISOString() },
    { id: "h3",  date: d(0), amount: 320,  category_id: "groceries",        paid_by: "user1", created_by: "user2", created_at: new Date().toISOString(), notes: "Supermarket run" },
    { id: "h4",  date: d(1), amount: 3500, category_id: "shopping",         paid_by: "user1", created_by: "user1", created_at: new Date().toISOString(), notes: "Clothes" },
    { id: "h5",  date: d(1), amount: 250,  category_id: "eating-out",       paid_by: "user2", created_by: "user2", created_at: new Date().toISOString() },
    { id: "h6",  date: d(2), amount: 890,  category_id: "daily-necessities",paid_by: "user1", created_by: "user1", created_at: new Date().toISOString(), notes: "Household supplies" },
    { id: "h7",  date: d(2), amount: 390,  category_id: "entertainment",    paid_by: "user2", created_by: "user2", created_at: new Date().toISOString(), notes: "Netflix" },
    { id: "h8",  date: d(3), amount: 680,  category_id: "groceries",        paid_by: "user1", created_by: "user1", created_at: new Date().toISOString(), notes: "Groceries" },
    { id: "h9",  date: d(3), amount: 150,  category_id: "transportation",   paid_by: "user2", created_by: "user2", created_at: new Date().toISOString() },
    { id: "h10", date: d(4), amount: 2100, category_id: "medical",          paid_by: "user2", created_by: "user2", created_at: new Date().toISOString(), notes: "Doctor visit" },
    { id: "h11", date: d(4), amount: 560,  category_id: "fuel",             paid_by: "user1", created_by: "user1", created_at: new Date().toISOString() },
    { id: "h12", date: d(4), amount: 200,  category_id: "tolls",            paid_by: "user1", created_by: "user2", created_at: new Date().toISOString() },
    { id: "h13", date: d(5), amount: 780,  category_id: "eating-out",       paid_by: "user2", created_by: "user2", created_at: new Date().toISOString(), notes: "Dinner out" },
    { id: "h14", date: d(5), amount: 4200, category_id: "rent",             paid_by: "user1", created_by: "user1", created_at: new Date().toISOString() },
    { id: "h15", date: d(5), amount: 350,  category_id: "digital",          paid_by: "user2", created_by: "user2", created_at: new Date().toISOString(), notes: "Spotify" },
    { id: "h16", date: d(6), amount: 1800, category_id: "clothing",         paid_by: "user1", created_by: "user1", created_at: new Date().toISOString(), notes: "Shoes" },
    { id: "h17", date: d(6), amount: 600,  category_id: "groceries",        paid_by: "user2", created_by: "user2", created_at: new Date().toISOString() },
    { id: "h18", date: d(6), amount: 130,  category_id: "transportation",   paid_by: "user1", created_by: "user1", created_at: new Date().toISOString() },
    { id: "h19", date: d(6), amount: 2500, category_id: "equipment",        paid_by: "user2", created_by: "user2", created_at: new Date().toISOString(), notes: "Repair tools" },
    { id: "h20", date: d(6), amount: 490,  category_id: "entertainment",    paid_by: "user1", created_by: "user1", created_at: new Date().toISOString(), notes: "Cinema tickets" },
  ];
}
