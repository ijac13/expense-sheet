import { MOCK_EXPENSES } from "../../lib/expenses";
import EditExpenseClient from "./EditExpenseClient";

export function generateStaticParams() {
  return MOCK_EXPENSES.map(e => ({ id: e.id }));
}

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expense = MOCK_EXPENSES.find(e => e.id === id);

  if (!expense) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-base-100 px-4 gap-4">
        <p className="text-lg">This expense no longer exists.</p>
        <a href="/" className="btn btn-ghost">Back</a>
      </main>
    );
  }

  return <EditExpenseClient expense={expense} />;
}
