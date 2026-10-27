import type { SVGAttributes } from "react";
import { cn } from "./cn";

export interface MioProps extends Omit<SVGAttributes<SVGSVGElement>, "children"> {
  /** "face" is the head alone; "coin" adds the riel coin, for paid moments. */
  pose?: "face" | "coin";
  /** Width and height in px. */
  size?: number;
  /** Screen-reader name, from the translation files. Leave it out when Mio is only decoration. */
  label?: string;
}

// Mio, the Khmio rabbit (docs/platform-launch-plan.md, Stage 1). A placeholder
// drawing until a designer delivers the final artwork. The body follows the
// brand token through currentColor, so it changes with the viewer's accent;
// the eyes, nose, cheeks and coin are fixed illustration colours.
export function Mio({ pose = "face", size = 96, label, className, ...props }: MioProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("shrink-0 text-brand", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      <g transform="rotate(-10 78 70)">
        <ellipse cx="78" cy="58" rx="17" ry="46" fill="currentColor" />
        <ellipse cx="78" cy="62" rx="8" ry="32" fill="#FFFFFF" fillOpacity="0.55" />
      </g>
      <g transform="rotate(10 122 70)">
        <ellipse cx="122" cy="58" rx="17" ry="46" fill="currentColor" />
        <ellipse cx="122" cy="62" rx="8" ry="32" fill="#FFFFFF" fillOpacity="0.55" />
      </g>
      <circle cx="100" cy="125" r="56" fill="currentColor" />
      <ellipse cx="100" cy="142" rx="34" ry="25" fill="#FFFFFF" />
      <circle cx="80" cy="116" r="8" fill="#0F172A" />
      <circle cx="83" cy="113" r="2.5" fill="#FFFFFF" />
      <circle cx="120" cy="116" r="8" fill="#0F172A" />
      <circle cx="123" cy="113" r="2.5" fill="#FFFFFF" />
      <circle cx="68" cy="138" r="7" fill="#F9A8D4" />
      <circle cx="132" cy="138" r="7" fill="#F9A8D4" />
      <ellipse cx="100" cy="134" rx="7" ry="5" fill="#EC4899" />
      <path
        d="M100 139v6M100 145q-7 6-13 0M100 145q7 6 13 0"
        fill="none"
        stroke="#0F172A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {pose === "coin" && (
        <g>
          <circle cx="160" cy="168" r="20" fill="#FBBF24" stroke="#B45309" strokeWidth="3" />
          <text x="160" y="176" textAnchor="middle" fontSize="22" fontWeight="700" fill="#92400E">
            ៛
          </text>
        </g>
      )}
    </svg>
  );
}
