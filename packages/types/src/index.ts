// packages/types/src/index.ts

/**
 * Barrel file — re-exports everything from one entry point.
 *
 * Why? So consumers write:
 *   import { Lead, Session, IntentLevel } from '@chatbot/types'
 *
 * Not:
 *   import { Lead } from '@chatbot/types/src/lead.types'
 *   import { Session } from '@chatbot/types/src/chat.types'
 *
 * One import, clean and simple.
 */
export type * from "./common.types.js";
export type * from "./tenant.types.js";
export type * from "./chat.types.js";
export type * from "./lead.types.js";
export type * from "./marketo.types.js";
export type * from "./api.types.js";
