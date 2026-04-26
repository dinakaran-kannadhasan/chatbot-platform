/**
 * globalSetup runs ONCE before Vitest starts any workers.
 * This is the correct place to set process.env for all tests.
 *
 * Unlike setupFiles, globalSetup runs in the main process
 * before any test worker is created — so env vars are
 * guaranteed to be set before any module is ever imported.
 */
export function setup() {
  process.env["NODE_ENV"] = "test";
  process.env["PORT"] = "4001";
  process.env["MONGODB_URI"] = "mongodb://localhost:27017/chatbot-test";
  process.env["REDIS_URL"] = "redis://localhost:6379";
  process.env["ANTHROPIC_API_KEY"] = "sk-ant-test-placeholder";
  process.env["JWT_SECRET"] = "test-secret-minimum-32-characters-long!!";
  process.env["MARKETO_BASE_URL"] = "https://test.mktorest.com";
  process.env["MARKETO_CLIENT_ID"] = "test-client-id";
  process.env["MARKETO_CLIENT_SECRET"] = "test-client-secret";
  process.env["PINECONE_API_KEY"] = "test-pinecone-key";
  process.env["PINECONE_INDEX"] = "test-index";
  process.env["FRONTEND_URL"] = "http://localhost:3000";
}
