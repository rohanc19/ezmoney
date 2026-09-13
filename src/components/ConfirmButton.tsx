"use client";

import { useEffect, useRef, useState } from "react";

// A destructive action that asks first — without a browser dialog.
//
// This used to call window.confirm(). Once Chrome shows its "prevent this
// page from creating additional dialogs" checkbox and the user ticks it,
// confirm() returns false immediately without drawing anything, so every
// delete in the app silently stopped working and there was no way to tell
// from the screen. Arming the button in place cannot be suppressed, needs
// no dialog, and is a better target on a phone.

export default function ConfirmButton({
  message,
  confirmLabel,
  className,
  children,
}: {
  /** What is about to happen. Read out when the button is armed. */
  message: string;
  /** The armed label, e.g. "Tap again to delete". */
  confirmLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!armed) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          setArmed(true);
          // An armed button left alone goes back to safe on its own.
          timer.current = setTimeout(() => setArmed(false), 6000);
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="submit"
      aria-label={message}
      title={message}
      className={`${className ?? ""} ring-4 ring-red-300`}
      autoFocus
    >
      {confirmLabel ?? message}
    </button>
  );
}
