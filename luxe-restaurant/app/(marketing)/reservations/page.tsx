import { ReservationForm } from "@/components/reservations/ReservationForm";

export default function ReservationsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <span className="eyebrow">Book a table</span>
        <h1 className="mt-4 font-display text-5xl font-light text-ivory">Reservations</h1>
      </div>
      <div className="mt-16">
        <ReservationForm />
      </div>
    </main>
  );
}
