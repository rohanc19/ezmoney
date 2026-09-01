// Status shown as colour + word (never colour alone), so it still reads
// correctly for colour-blind eyes and in a black-and-white printout.
const styles: Record<string, string> = {
  draft: "bg-stone-200 text-stone-800",
  sent: "bg-sky-100 text-sky-900",
  approved: "bg-teal-100 text-teal-900",
  rejected: "bg-red-100 text-red-900",
  paid: "bg-green-100 text-green-900",
};

export default function StatusPill({
  status,
  label,
  size = "md",
}: {
  status: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-block rounded-full font-bold ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      } ${styles[status] ?? styles.draft}`}
    >
      {label}
    </span>
  );
}
