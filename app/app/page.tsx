export default function Home() {
  return (
    <main className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-8">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body items-center text-center gap-4">
          <h1 className="card-title text-3xl font-bold text-primary">
            Expense Tracker
          </h1>
          <p className="text-base-content/70">
            Your personal expense tracking app
          </p>
          <div className="card-actions flex-col w-full gap-2">
            <button className="btn btn-primary w-full">Add Expense</button>
            <button className="btn btn-secondary w-full">View Reports</button>
          </div>
          <div className="badge badge-accent">Fantasy Theme Active</div>
        </div>
      </div>
    </main>
  );
}
