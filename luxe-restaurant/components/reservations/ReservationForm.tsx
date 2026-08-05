"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Step = "party" | "datetime" | "details" | "confirm";

const TIME_SLOTS = ["17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

export function ReservationForm() {
  const [step, setStep] = useState<Step>("party");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ status: string; requiresDeposit: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAvailability(selectedDate: string) {
    setDate(selectedDate);
    if (!selectedDate) return;
    const res = await fetch(`/api/reservations?date=${new Date(selectedDate).toISOString()}`);
    const data = await res.json();
    setAvailability(data.bookedBySlot ?? {});
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // CSRF token cookie is set by the auth layer on session start;
          // read it client-side and mirror it in the header (double-submit).
          "x-csrf-token": getCsrfCookie(),
        },
        body: JSON.stringify({
          guestName,
          guestPhone,
          guestEmail: guestEmail || undefined,
          partySize,
          date: new Date(date).toISOString(),
          timeSlot,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Something went wrong. Please try another time.");
        return;
      }

      const data = await res.json();
      setResult(data);

      if (data.requiresDeposit) {
        // Large parties require a deposit — hand off to Stripe Checkout.
        const checkout = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfCookie() },
          body: JSON.stringify({
            kind: "catering_deposit",
            amountCents: 5000 * Math.ceil(partySize / 8),
            reservationId: data.id,
          }),
        });
        const { url } = await checkout.json();
        if (url) window.location.href = url;
        return;
      }

      setStep("confirm");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <AnimatePresence mode="wait">
        {step === "party" && (
          <StepShell key="party" title="Party size">
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                className="h-10 w-10 rounded-full border border-champagne/40 text-champagne"
                aria-label="Decrease party size"
              >
                −
              </button>
              <span className="font-display text-4xl text-ivory">{partySize}</span>
              <button
                onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                className="h-10 w-10 rounded-full border border-champagne/40 text-champagne"
                aria-label="Increase party size"
              >
                +
              </button>
            </div>
            {partySize >= 8 && (
              <p className="mt-4 text-center font-mono text-xs text-ash">
                Parties of 8+ require a deposit to confirm.
              </p>
            )}
            <NextButton onClick={() => setStep("datetime")} />
          </StepShell>
        )}

        {step === "datetime" && (
          <StepShell key="datetime" title="Date & time">
            <input
              type="date"
              value={date}
              onChange={(e) => loadAvailability(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-sm border border-champagne/25 bg-onyx px-4 py-3 font-mono text-sm text-ivory"
            />
            <div className="mt-4 grid grid-cols-4 gap-2">
              {TIME_SLOTS.map((slot) => {
                const booked = availability[slot] ?? 0;
                const full = booked + partySize > 40;
                return (
                  <button
                    key={slot}
                    disabled={full}
                    onClick={() => setTimeSlot(slot)}
                    className={`rounded-sm border px-2 py-2 font-mono text-xs transition-colors duration-300 ease-silk ${
                      timeSlot === slot
                        ? "border-champagne bg-champagne text-onyx"
                        : full
                        ? "cursor-not-allowed border-ash/20 text-ash/40"
                        : "border-champagne/25 text-ash hover:border-champagne/60"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
            <NextButton onClick={() => setStep("details")} disabled={!date || !timeSlot} />
          </StepShell>
        )}

        {step === "details" && (
          <StepShell key="details" title="Your details">
            <div className="space-y-3">
              <input
                placeholder="Full name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-sm border border-champagne/25 bg-onyx px-4 py-3 text-sm text-ivory placeholder:text-ash/60"
              />
              <input
                placeholder="Phone (+14155551234)"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full rounded-sm border border-champagne/25 bg-onyx px-4 py-3 text-sm text-ivory placeholder:text-ash/60"
              />
              <input
                placeholder="Email (optional)"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full rounded-sm border border-champagne/25 bg-onyx px-4 py-3 text-sm text-ivory placeholder:text-ash/60"
              />
            </div>
            {error && <p className="mt-3 font-mono text-xs text-burgundy">{error}</p>}
            <NextButton
              label={submitting ? "Booking…" : "Confirm reservation"}
              onClick={submit}
              disabled={!guestName || !guestPhone || submitting}
            />
          </StepShell>
        )}

        {step === "confirm" && result && (
          <StepShell key="confirm" title="You're booked">
            <p className="text-center text-sm text-ash">
              Table for {partySize} on {date} at {timeSlot}. A confirmation has been sent.
            </p>
          </StepShell>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-sm border border-champagne/15 bg-graphite p-8"
    >
      <h2 className="mb-6 text-center font-display text-2xl font-light text-ivory">{title}</h2>
      {children}
    </motion.div>
  );
}

function NextButton({
  onClick,
  disabled,
  label = "Continue",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-8 w-full rounded-sm border border-champagne bg-champagne py-3 font-mono text-xs uppercase tracking-widest2 text-onyx transition-all duration-300 ease-silk hover:bg-champagne-bright disabled:cursor-not-allowed disabled:border-ash/20 disabled:bg-transparent disabled:text-ash/40"
    >
      {label}
    </button>
  );
}

function getCsrfCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}
