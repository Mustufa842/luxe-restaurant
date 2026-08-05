import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPII } from "@/lib/crypto";

// Server component — role check happens before any data is fetched or rendered.
// This is defense-in-depth alongside a matching check you should add in
// middleware.ts (route-group based) once /admin grows beyond this page.
export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (!session || role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin");
  }

  const [reservations, orders, chatSessions] = await Promise.all([
    prisma.reservation.findMany({
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: true },
    }),
    prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-ivory">
      <h1 className="font-display text-4xl font-light">Admin Dashboard</h1>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-champagne">Reservations</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ash">
              <tr>
                <th className="py-2">Guest</th>
                <th>Phone</th>
                <th>Party</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="hairline">
                  <td className="py-2">{r.guestName}</td>
                  {/* Decrypted only here, server-side, for an authenticated admin. */}
                  <td>{safeDecrypt(r.guestPhoneEncrypted)}</td>
                  <td>{r.partySize}</td>
                  <td>{r.date.toDateString()}</td>
                  <td>{r.timeSlot}</td>
                  <td>{r.status}</td>
                  <td>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-champagne">Orders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ash">
              <tr>
                <th className="py-2">Order</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hairline">
                  <td className="py-2 font-mono text-xs">{o.id}</td>
                  <td>{o.items.length}</td>
                  <td>${(o.totalCents / 100).toFixed(2)}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-champagne">AI Chat Logs</h2>
        <div className="mt-4 space-y-3">
          {chatSessions.map((c) => (
            <div key={c.id} className="hairline pt-3 font-mono text-xs text-ash">
              {c.channel} · {c.updatedAt.toLocaleString()} · {c.id}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function safeDecrypt(value: string) {
  try {
    return decryptPII(value);
  } catch {
    return "—";
  }
}
