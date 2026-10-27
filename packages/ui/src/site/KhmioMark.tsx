import { cn } from "../cn";

/** The Khmio app icon (option C, "k" with Mio's ears) and the khmio wordmark, as one logo. */
export function KhmioLogo({ className, label = "Khmio" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="img" aria-label={label}>
      <KhmioMark size={32} />
      <span className="text-xl font-bold tracking-tight text-fg" aria-hidden="true">
        khm<span className="text-brand">io</span>
      </span>
    </span>
  );
}

/** The app icon alone. Follows the brand token, like the rest of the app. */
export function KhmioMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={cn("shrink-0 text-brand", className)} aria-hidden="true">
      <g transform="rotate(-12 78 44)">
        <ellipse cx="78" cy="40" rx="16" ry="34" fill="currentColor" />
        <ellipse cx="78" cy="44" rx="6" ry="22" fill="#FFFFFF" fillOpacity="0.55" />
      </g>
      <g transform="rotate(12 122 44)">
        <ellipse cx="122" cy="40" rx="16" ry="34" fill="currentColor" />
        <ellipse cx="122" cy="44" rx="6" ry="22" fill="#FFFFFF" fillOpacity="0.55" />
      </g>
      <rect y="48" width="200" height="152" rx="40" fill="currentColor" />
      {/* on-brand, not white: in dark mode the brand turns light and the letter turns dark. */}
      <path
        className="text-on-brand"
        d="M74 84v84M74 136l44-36M90 124l34 44"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
