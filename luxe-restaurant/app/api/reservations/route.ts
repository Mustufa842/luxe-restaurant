import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptPII } from "@/lib/crypto";
import { reservationRequestSchema, parseOrThrow, ValidationError } from "@/lib/validation";

const MAX_COVERS_PER_SLOT = 40; // dining-room capacity per 30-min seating window
const DEPOSIT_THRESHOLD_PARTY_SIZE = 8; // large parties require a deposit

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = parseOrThrow(reservationRequestSchema, await req.json());

    const requestedDate = new Date(body.date);
    if (Number.isNaN(requestedDate.getTime()) || requestedDate < new Date()) {
      return NextResponse.json({ error: "Invalid or past date" }, { status: 400 });
    }

    // Real-time availability check against covers already booked in that slot.
    const existing = await prisma.reservation.aggregate({
      where: {
        date: requestedDate,
        timeSlot: body.timeSlot,
        status: { in: ["PENDING", "CONFIRMED", "DEPOSIT_REQUIRED"] },
      },
      _sum: { partySize: true },
    });
    const bookedCovers = existing._sum.partySize ?? 0;

    if (bookedCovers + body.partySize > MAX_COVERS_PER_SLOT) {
      return NextResponse.json(
        { error: "That time is fully booked. Please choose another slot." },
        { status: 409 }
      );
    }

    const requiresDeposit = body.partySize >= DEPOSIT_THRESHOLD_PARTY_SIZE;

    const reservation = await prisma.reservation.create({
      data: {
        userId: (session?.user as any)?.id ?? null,
        guestName: body.guestName,
        guestPhoneEncrypted: encryptPII(body.guestPhone),
        guestEmail: body.guestEmail,
        partySize: body.partySize,
        date: requestedDate,
        timeSlot: body.timeSlot,
        notes: body.notes,
        source: "WEBSITE",
        status: requiresDeposit ? "DEPOSIT_REQUIRED" : "CONFIRMED",
        depositRequired: requiresDeposit,
      },
    });

    return NextResponse.json(
      {
        id: reservation.id,
        status: reservation.status,
        requiresDeposit,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
    }
    console.error("[reservations] create failed", err);
    return NextResponse.json({ error: "Unable to create reservation" }, { status: 500 });
  }
}

/** Real-time availability lookup, used by the booking widget's date/time picker. */
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "date query param required" }, { status: 400 });
  }

  const date = new Date(dateParam);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const reservations = await prisma.reservation.groupBy({
    by: ["timeSlot"],
    where: {
      date,
      status: { in: ["PENDING", "CONFIRMED", "DEPOSIT_REQUIRED"] },
    },
    _sum: { partySize: true },
  });

  const bookedBySlot = Object.fromEntries(
    reservations.map((r) => [r.timeSlot, r._sum.partySize ?? 0])
  );

  return NextResponse.json({ maxCoversPerSlot: MAX_COVERS_PER_SLOT, bookedBySlot });
}
