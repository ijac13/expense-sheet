export default function StagingBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "staging") return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-6 bg-orange-500 flex items-center justify-center">
      <span className="text-white text-xs font-bold tracking-widest uppercase">
        Staging
      </span>
    </div>
  );
}
