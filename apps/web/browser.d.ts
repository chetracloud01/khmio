// Browser features some phones have that TypeScript's own lists leave out.
// Declared here once, so the code checks for them instead of forcing a type.

/** Chrome on Android: the "Install app" prompt, held until the seller taps Install (components/seller-app.tsx). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

interface Window {
  /** Older Safari's name for AudioContext. */
  webkitAudioContext?: typeof AudioContext;
}

interface Navigator {
  /** iPhone: true inside an app added to the home screen. */
  standalone?: boolean;
}
