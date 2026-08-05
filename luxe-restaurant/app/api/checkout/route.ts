import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { checkoutSessionRequestSchema, parseOrThrow, ValidationError } from "@/lib/validation";

const LABELS: Record<string, string> = {
  catering_deposit: "Catering Reservation Deposit",
  gift_card: "Luxe Restaurant Gift Card",
  premium_takeout: "Premium Takeout Order",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = parseOrThrow(checkoutSessionRequestSchema, await req.json());

    // If this checkout is tied to a reservation, confirm it belongs to this user.
    if (body.reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: body.reservationId },
      });
      if (!reservation || reservation.userId !== (session.user as any).id) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: LABELS[body.kind] },
            unit_amount: body.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: body.kind,
        userId: (session.user as any).id,
        reservationId: body.reservationId ?? "",
        ...body.metadata,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/reservations/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/reservations`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30-minute expiry
    });

    // Log intent immediately so we can reconcile even if the webhook is delayed.
    await prisma.paymentLog.create({
      data: {
        stripeCheckoutSessionId: checkoutSession.id,
        amountCents: body.amountCents,
        status: "REQUIRES_PAYMENT",
        reservationId: body.reservationId ?? null,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
    }
    console.error("[checkout] failed", err);
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}
