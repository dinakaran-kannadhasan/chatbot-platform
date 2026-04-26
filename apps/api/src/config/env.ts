import { z } from "zod";

/**
 * Why remove dotenv from here?
 *
 * dotenv.config() reads a .env file and sets process.env.
 * In tests, Vitest's setupFiles already sets process.env
 * before any module loads. When dotenv runs after that,
 * it overwrites our test values with whatever is in .env
 * (which may be empty or missing entirely).
 *
 * The fix: only load dotenv in non-test environments.
 * In production and development, dotenv loads the .env file.
 * In tests, process.env is already set by tests/setup.ts.
 *
 * This is the correct pattern used in production codebases.
 */
if (process.env["NODE_ENV"] !== "test") {
  // Dynamic import so this only runs outside tests
  // We use require() because this is CommonJS
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv") as typeof import("dotenv");
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().default("4000").transform(Number),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security"),

  MARKETO_BASE_URL: z.string().url("MARKETO_BASE_URL must be a valid URL"),
  MARKETO_CLIENT_ID: z.string().min(1, "MARKETO_CLIENT_ID is required"),
  MARKETO_CLIENT_SECRET: z.string().min(1, "MARKETO_CLIENT_SECRET is required"),

  PINECONE_API_KEY: z.string().min(1, "PINECONE_API_KEY is required"),
  PINECONE_INDEX: z.string().default("chatbot-knowledge"),

  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
