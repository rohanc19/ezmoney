// Status shown as colour + word (never colour alone).
const styles: Record<string, string> = {
  draft: "bg-stone-200 text-stone-800",
  sent: "bg-blue-100 text-blue-900",
  approved: "bg-teal-100 text-teal-900",
  rejected: "bg-red-100 text-red-900",
  paid: "bg-green-100 text-green-900",
};

export default function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${styles[status] ?? styles.draft}`}
    >
      {label}
    </span>
  );
}
