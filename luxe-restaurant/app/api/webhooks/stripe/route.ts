import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Stripe requires the exact raw request body (unparsed) to verify the
// signature — Next.js's default body parsing would break this.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    // Signature mismatch = either a stale secret or a spoofed request.
    // Reject outright; never process an unverified payload.
    console.error("[stripe-webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(checkoutSession, event.type);
        break;
      }

      case "checkout.session.expired": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await prisma.paymentLog.updateMany({
          where: { stripeCheckoutSessionId: checkoutSession.id },
          data: { status: "EXPIRED", rawEventType: event.type },
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          await prisma.paymentLog.updateMany({
            where: { stripePaymentIntentId: charge.payment_intent as string },
            data: { status: "REFUNDED", rawEventType: event.type },
          });
        }
        break;
      }

      default:
        // Unhandled event types are fine to no-op — Stripe sends many
        // events we don't act on. Log for audit visibility only.
        console.info(`[stripe-webhook] unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Returning a 500 tells Stripe to retry with backoff — appropriate
    // for transient DB failures, not for logic errors we've already handled.
    console.error("[stripe-webhook] handler error", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventType: string) {
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  const log = await prisma.paymentLog.update({
    where: { stripeCheckoutSessionId: session.id },
    data: {
      status: "SUCCEEDED",
      stripePaymentIntentId: paymentIntentId,
      rawEventType: eventType,
    },
  });

  // Flip the linked reservation/order into a confirmed state.
  if (log.reservationId) {
    await prisma.reservation.update({
      where: { id: log.reservationId },
      data: { status: "CONFIRMED" },
    });
  }
  if (log.orderId) {
    await prisma.order.update({
      where: { id: log.orderId },
      data: { status: "PAID" },
    });
  }

  // TODO: enqueue confirmation email / WhatsApp message here.
}
