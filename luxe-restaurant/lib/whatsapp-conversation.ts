import { setup, assign } from "xstate";

/**
 * Conversational state machine for the WhatsApp concierge.
 * Each phone number gets its own machine instance; the serialized
 * `context` + current state value is persisted on ChatSession
 * (keyed by externalId = the WhatsApp JID) between incoming messages,
 * so the bot picks up mid-conversation even across process restarts.
 * Driven from whatsapp-bot/bot.ts (a persistent Baileys connection).
 */

export interface WhatsAppContext {
  partySize?: number;
  date?: string;
  timeSlot?: string;
  name?: string;
}

export type WhatsAppEvent =
  | { type: "MENU" }
  | { type: "SPECIALS" }
  | { type: "BOOK" }
  | { type: "PROVIDE_PARTY_SIZE"; value: number }
  | { type: "PROVIDE_DATE"; value: string }
  | { type: "PROVIDE_TIME"; value: string }
  | { type: "PROVIDE_NAME"; value: string }
  | { type: "CONFIRM" }
  | { type: "RESTART" };

export const whatsAppMachine = setup({
  types: {
    context: {} as WhatsAppContext,
    events: {} as WhatsAppEvent,
  },
}).createMachine({
  id: "whatsapp-concierge",
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: {
        MENU: "showingMenu",
        SPECIALS: "showingSpecials",
        BOOK: "collectingPartySize",
      },
    },
    showingMenu: { on: { BOOK: "collectingPartySize", RESTART: "idle" } },
    showingSpecials: { on: { BOOK: "collectingPartySize", RESTART: "idle" } },

    collectingPartySize: {
      on: {
        PROVIDE_PARTY_SIZE: {
          target: "collectingDate",
          actions: assign({ partySize: ({ event }) => event.value }),
        },
      },
    },
    collectingDate: {
      on: {
        PROVIDE_DATE: {
          target: "collectingTime",
          actions: assign({ date: ({ event }) => event.value }),
        },
      },
    },
    collectingTime: {
      on: {
        PROVIDE_TIME: {
          target: "collectingName",
          actions: assign({ timeSlot: ({ event }) => event.value }),
        },
      },
    },
    collectingName: {
      on: {
        PROVIDE_NAME: {
          target: "confirming",
          actions: assign({ name: ({ event }) => event.value }),
        },
      },
    },
    confirming: {
      on: {
        CONFIRM: "booked",
        RESTART: { target: "idle", actions: assign(() => ({})) },
      },
    },
    booked: { type: "final" },
  },
});
