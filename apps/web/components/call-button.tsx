import { Phone } from "lucide-react";

// A round "call" link for a buyer's phone, saved as 855… (CLAUDE.md "Phone"):
// the orders list and a customer's page. It sits inside rows that open on a
// tap, so the tap stops here.

export function CallButton({ phone, label }: { phone: string; label: string }) {
  return (
    <a
      href={`tel:+${phone}`}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand hover:bg-brand/15"
    >
      <Phone className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
