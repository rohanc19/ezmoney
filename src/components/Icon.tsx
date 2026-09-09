// Inline SVG, not emoji. His old Windows PC has gaps in its emoji font and
// draws tofu boxes instead — the same reason the app ships its own rupee
// glyph. Everything here is one stroked path at currentColor.

export type IconName = "search" | "camera" | "list" | "clip" | "bill" | "people";

const paths: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5h3.2l1.4-2h8.8l1.4 2H21v11H3z" />
      <circle cx="12" cy="14" r="3.6" />
    </>
  ),
  list: <path d="M4 7h16M4 12h16M4 17h16" />,
  clip: <path d="M18 8.5 10.5 16a3 3 0 0 1-4.2-4.2l8-8a4.5 4.5 0 0 1 6.4 6.4l-8.4 8.4a6 6 0 0 1-8.5-8.5" />,
  bill: (
    <>
      <path d="M6 3.5v17l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4v-17l-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9.5 9h5M9.5 13h5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5 6-5s6 1.8 6 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.4M17.5 14.6c2 .7 3.5 2.2 3.5 4.4" />
    </>
  ),
};

export default function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
