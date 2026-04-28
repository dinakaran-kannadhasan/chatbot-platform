import type {
  PineconeRecord,
  RecordMetadata,
} from "@pinecone-database/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import axios from "axios";
import https from "https";
import { env } from "../config/env.js";

let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return pineconeClient;
}

export interface RagChunk {
  id: string;
  content: string;
  score: number;
  metadata: {
    url: string;
    section: string;
  };
}

interface ChunkMetadata extends RecordMetadata {
  text: string;        // matches seed script metadata field
  url: string;
  source: string;      // matches seed script metadata field
  section: string;
  websiteId: string;
}

/**
 * Embed a query string using Voyage AI (voyage-large-2, 1536 dims).
 * Must match the model used in seed-knowledge.ts exactly.
 */
export async function embedText(text: string): Promise<number[]> {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });

  const response = await axios.post(
    "https://api.voyageai.com/v1/embeddings",
    {
      model: "voyage-large-2",
      input: [text],
      input_type: "query",
    },
    {
      headers: {
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    },
  );

  const embedding = (response.data as any).data[0]?.embedding as
    | number[]
    | undefined;

  if (!embedding) {
    throw new Error("Failed to generate embedding — empty response from Voyage API");
  }

  return embedding;
}

/**
 * Retrieve relevant chunks from Pinecone for a given query.
 * Uses cosine similarity — threshold 0.5 (lower than before to get more results).
 */
export async function retrieveContext(
  query: string,
  websiteId: string,
  topK = 5,
): Promise<RagChunk[]> {
  const queryEmbedding = await embedText(query);

  const pc = getPinecone();
  const index = pc.index<ChunkMetadata>(env.PINECONE_INDEX);

  const results = await index.namespace(websiteId).query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return (results.matches ?? [])
    .filter((match) => (match.score ?? 0) > 0.5)
    .map((match) => ({
      id: match.id,
      content: match.metadata?.text ?? "",   // "text" matches seed script
      score: match.score ?? 0,
      metadata: {
        url: match.metadata?.url ?? "",
        section: match.metadata?.source ?? match.metadata?.section ?? "",
      },
    }));
}

/**
 * Format retrieved chunks into a prompt-ready context string.
 */
export function formatContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";

  const formatted = chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}: ${chunk.metadata.section} — ${chunk.metadata.url}]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");

  return `RELEVANT CONTEXT FROM APPVIEWX WEBSITE:\n\n${formatted}\n\n---\n\nUse only the above context to answer. If the answer is not in the context, say you'll connect the user with the team.`;
}

/**
 * Index content into Pinecone (used by seed script alternative).
 */
export async function indexContent(
  content: Array<{
    id: string;
    text: string;
    url: string;
    section: string;
  }>,
  websiteId: string,
): Promise<void> {
  const pc = getPinecone();
  const index = pc.index<ChunkMetadata>(env.PINECONE_INDEX);
  const BATCH_SIZE = 10;

  for (let i = 0; i < content.length; i += BATCH_SIZE) {
    const batch = content.slice(i, i + BATCH_SIZE);
    const records: PineconeRecord<ChunkMetadata>[] = await Promise.all(
      batch.map(async (chunk) => {
        const values = await embedText(chunk.text);
        return {
          id: chunk.id,
          values,
          metadata: {
            text: chunk.text,
            url: chunk.url,
            source: chunk.section,
            section: chunk.section,
            websiteId,
          },
        };
      }),
    );
    await index.namespace(websiteId).upsert({ records });
  }
}
