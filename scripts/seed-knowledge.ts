import * as dotenv from "dotenv";
import * as cheerio from "cheerio";
import axios from "axios";
import https from "https";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config({ path: ".env.local" });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

const WEBSITE_ID = "appviewx";
const INDEX_NAME = process.env.PINECONE_INDEX!;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!;
const CHUNK_SIZE = 400;
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const PAGES = [
  { url: "https://www.appviewx.com", section: "homepage" },
  { url: "https://www.appviewx.com/avx-platform/", section: "platform" },
  { url: "https://www.appviewx.com/products/avx-one-clm/", section: "clm" },
  {
    url: "https://www.appviewx.com/products/avx-one-pkiaas/",
    section: "pkiaas",
  },
  {
    url: "https://www.appviewx.com/products/avx-one-clm-for-kubernetes/",
    section: "kubernetes",
  },
  {
    url: "https://www.appviewx.com/products/avx-one-code-signing/",
    section: "code-signing",
  },
  { url: "https://www.appviewx.com/products/avx-one-ssh/", section: "ssh" },
  { url: "https://www.appviewx.com/customers/", section: "customers" },
  { url: "https://www.appviewx.com/about/", section: "about" },
];

function chunkText(text: string, chunkSize: number = CHUNK_SIZE): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 100) chunks.push(chunk.trim());
  }
  return chunks;
}

async function scrapePage(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AppViewX-Bot/1.0)" },
      timeout: 15000,
      httpsAgent,
    });
    const $ = cheerio.load(response.data as string);
    $(
      "script, style, nav, footer, .cookie-banner, .popup, iframe, noscript, svg",
    ).remove();
    const parts: string[] = [];
    $("h1, h2, h3, h4, p, li, td, th, blockquote").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 30) parts.push(text);
    });
    return parts.join(" ");
  } catch (error) {
    console.warn(`⚠️  Failed to scrape ${url}:`, (error as Error).message);
    return "";
  }
}

async function embedTexts(texts: string[], retries = 5): Promise<number[][]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        "https://api.voyageai.com/v1/embeddings",
        { model: "voyage-large-2", input: texts },
        {
          headers: {
            Authorization: `Bearer ${VOYAGE_API_KEY}`,
            "Content-Type": "application/json",
          },
          httpsAgent,
        },
      );
      return (response.data as any).data.map((d: any) => d.embedding);
    } catch (error: any) {
      const is429 = error?.response?.status === 429;
      if (is429 && attempt < retries) {
        const wait = attempt * 8000;
        console.log(
          `   ⏳ Rate limited — waiting ${wait / 1000}s (attempt ${attempt}/${retries})`,
        );
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

async function seed() {
  console.log("🌱 Starting knowledge base seeding...\n");

  const index = pinecone.index(INDEX_NAME);
  console.log(`📍 Pinecone index: ${INDEX_NAME}`);
  console.log(`🌐 Scraping ${PAGES.length} pages\n`);

  const allRecords: Array<{
    id: string;
    values: number[];
    metadata: Record<string, string>;
  }> = [];

  for (const page of PAGES) {
    console.log(`📄 Scraping: ${page.url}`);
    const text = await scrapePage(page.url);
    if (!text) {
      console.log(`   ⚠️  No content, skipping\n`);
      continue;
    }

    const chunks = chunkText(text);
    console.log(`   ✓ ${chunks.length} chunks extracted`);

    // Process one chunk at a time to avoid rate limits
    for (let i = 0; i < chunks.length; i += 2) {
      const batch = chunks.slice(i, i + 2);
      try {
        const embeddings = await embedTexts(batch);
        batch.forEach((chunk, j) => {
          allRecords.push({
            id: `${WEBSITE_ID}-${page.section}-chunk-${i + j}`,
            values: embeddings[j]!,
            metadata: {
              text: chunk,
              source: page.section,
              url: page.url,
              websiteId: WEBSITE_ID,
            },
          });
        });
        console.log(
          `   ✓ Embedded ${Math.min(i + 2, chunks.length)}/${chunks.length}`,
        );
        // Wait 4 seconds between every batch
        await new Promise((r) => setTimeout(r, 4000));
      } catch (error) {
        console.error(`   ❌ Embedding error:`, (error as Error).message);
      }
    }
    console.log();
    // Extra 5 second pause between pages
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (allRecords.length === 0) {
    console.error("❌ No vectors to upsert — check API keys");
    process.exit(1);
  }

  // Replace the upsert section at the bottom with this:
  console.log(`📤 Upserting ${allRecords.length} vectors to Pinecone...`);

  for (let i = 0; i < allRecords.length; i += 100) {
    const batch = allRecords.slice(i, i + 100);
    if (batch.length === 0) continue;

    // Pinecone v7 upsert syntax
    await index.namespace(WEBSITE_ID).upsert({ records: batch });
    console.log(
      `   ✓ Upserted ${Math.min(i + 100, allRecords.length)}/${allRecords.length}`,
    );
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(
    `📦 ${allRecords.length} vectors seeded to namespace: ${WEBSITE_ID}`,
  );
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
