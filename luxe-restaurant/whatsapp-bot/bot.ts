/**
 * WhatsApp booking bot — Baileys (open-source WhatsApp Web protocol client).
 *
 * WHY THIS FILE IS SEPARATE FROM app/api/:
 * Twilio's WhatsApp product is a webhook — WhatsApp's servers POST to your
 * URL, so it fits naturally into a serverless Next.js route. Baileys is the
 * opposite shape: it opens and holds a persistent WebSocket connection to
 * WhatsApp's servers, authenticated by scanning a QR code once (like linking
 * WhatsApp Web on your phone). That connection has to stay alive continuously,
 * which a serverless function (Vercel, etc.) is not designed to do — those
 * environments spin down when idle. So this runs as its own long-lived Node
 * process: on a small always-on box (Oracle Cloud's free-tier VM is the
 * usual zero-cost choice), not on Vercel alongside the website.
 *
 * IMPORTANT — READ BEFORE USING IN PRODUCTION:
 * Baileys works by reverse-engineering WhatsApp Web's protocol, not through
 * an official Meta Business API. WhatsApp's Terms of Service prohibit
 * unofficial clients, and numbers using tools like this have been banned in
 * practice — search "Baileys ban" before committing your restaurant's real
 * business number to this approach. It is genuinely free and it does work,
 * but "free" here is a real trade-off against reliability and ToS risk, not
 * a strictly-better swap for Twilio's official (paid) WhatsApp Business API.
 * If the restaurant's WhatsApp channel needs to be dependable, budget for
 * Twilio (or Meta's own Cloud API, which has a free tier of its own) instead.
 *
 * RUNNING THIS:
 *   1. From the project root: npm install (Baileys is already in package.json)
 *   2. npm run whatsapp:bot
 *   3. Scan the QR code printed in the terminal with WhatsApp
 *      (Linked Devices → Link a Device) on the restaurant's phone.
 *   4. Keep this process running (pm2, systemd, screen/tmux, or a Docker
 *      container on your always-on VM) — if it stops, WhatsApp messages
 *      simply won't be answered until you restart it and it reconnects.
 */

import { config } from "dotenv";
config();

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { prisma } from "../lib/prisma";
import { encryptPII } from "../lib/crypto";
import { createActor } from "xstate";
import { whatsAppMachine, type WhatsAppContext } from "../lib/whatsapp-conversation";

const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR ?? "./whatsapp-bot/.auth";

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // we render it ourselves for a clearer prompt
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nScan this QR code with WhatsApp (Linked Devices → Link a Device):\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed.", shouldReconnect ? "Reconnecting…" : "Logged out.");
      if (shouldReconnect) start();
    } else if (connection === "open") {
      console.log("✔ WhatsApp bot connected.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from || from.endsWith("@g.us")) continue; // ignore group chats

      const text = extractText(msg);
      if (!text) continue;

      try {
        const reply = await handleMessage(from, text);
        await sock.sendMessage(from, { text: reply });
      } catch (err) {
        console.error("[whatsapp-bot] failed to handle message", err);
        await sock.sendMessage(from, {
          text: "Sorry, something went wrong on our end — please try again shortly.",
        });
      }
    }
  });
}

function extractText(msg: WAMessage): string | undefined {
  return (
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.buttonsResponseMessage?.selectedButtonId ??
    undefined
  )?.trim();
}

type PersistedState = { value: string; context: WhatsAppContext };

/**
 * Same conversational state machine used in the original Twilio design —
 * only the transport (Baileys socket vs. Twilio webhook) changed. State is
 * persisted per WhatsApp JID via ChatSession.externalId so the bot picks up
 * where it left off across process restarts.
 */
async function handleMessage(from: string, text: string): Promise<string> {
  let chatSession = await prisma.chatSession.findUnique({ where: { externalId: from } });
  chatSession =
    chatSession ??
    (await prisma.chatSession.create({
      data: { channel: "whatsapp", externalId: from, messages: [] },
    }));

  const stored = (chatSession.messages as any)?.state as PersistedState | undefined;
  const actor = createActor(whatsAppMachine, {
    snapshot: stored ? whatsAppMachine.resolveState(stored as any) : undefined,
  });
  actor.start();

  const reply = respond(actor, text);

  const snapshot = actor.getPersistedSnapshot();
  await prisma.chatSession.update({
    where: { id: chatSession.id },
    data: { messages: { state: snapshot, lastMessage: text } as any },
  });

  if (actor.getSnapshot().value === "booked") {
    await createReservationFromWhatsApp(from, actor.getSnapshot().context);
  }

  actor.stop();
  return reply;
}

// `actor` is the xstate Actor created from whatsAppMachine — typed loosely
// here since its exact generic shape isn't the point of this example.
function respond(actor: any, text: string): string {
  const lower = text.toLowerCase();
  const state = actor.getSnapshot().value as string;

  if (state === "idle") {
    if (lower.includes("menu")) {
      actor.send({ type: "MENU" });
      return "Here's tonight's menu: [link]. Reply BOOK to reserve a table.";
    }
    if (lower.includes("special")) {
      actor.send({ type: "SPECIALS" });
      return "Tonight's specials: [chef's tasting menu]. Reply BOOK to reserve.";
    }
    if (lower.includes("book") || lower.includes("table") || lower.includes("reserv")) {
      actor.send({ type: "BOOK" });
      return "Wonderful — how many guests will be joining?";
    }
    return "Welcome to Luxe. Reply MENU, SPECIALS, or BOOK to reserve a table.";
  }

  if (state === "collectingPartySize") {
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n < 1 || n > 20) return "Please reply with a party size between 1 and 20.";
    actor.send({ type: "PROVIDE_PARTY_SIZE", value: n });
    return "Great — what date would you like? (e.g. 2026-08-20)";
  }

  if (state === "collectingDate") {
    if (Number.isNaN(Date.parse(text))) return "Please send a date like 2026-08-20.";
    actor.send({ type: "PROVIDE_DATE", value: text });
    return "And what time? (e.g. 19:30)";
  }

  if (state === "collectingTime") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return "Please send a time like 19:30.";
    actor.send({ type: "PROVIDE_TIME", value: text });
    return "Lastly, what name should the reservation be under?";
  }

  if (state === "collectingName") {
    actor.send({ type: "PROVIDE_NAME", value: text });
    const c = actor.getSnapshot().context;
    return `Please confirm: table for ${c.partySize} on ${c.date} at ${c.timeSlot} under "${c.name}". Reply YES to confirm.`;
  }

  if (state === "confirming") {
    if (lower === "yes" || lower === "y") {
      actor.send({ type: "CONFIRM" });
      return "Booked! We look forward to hosting you. Reply MENU or SPECIALS any time.";
    }
    actor.send({ type: "RESTART" });
    return "No problem — let's start over. Reply MENU, SPECIALS, or BOOK.";
  }

  return "Reply MENU, SPECIALS, or BOOK to get started.";
}

async function createReservationFromWhatsApp(from: string, ctx: WhatsAppContext) {
  const phone = from.split("@")[0];
  await prisma.reservation.create({
    data: {
      guestName: ctx.name ?? "WhatsApp Guest",
      guestPhoneEncrypted: encryptPII(phone),
      partySize: ctx.partySize ?? 2,
      date: new Date(ctx.date!),
      timeSlot: ctx.timeSlot!,
      source: "WHATSAPP",
      status: "CONFIRMED",
    },
  });
}

start().catch((err) => {
  console.error("[whatsapp-bot] fatal error", err);
  process.exit(1);
});
