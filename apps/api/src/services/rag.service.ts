import type {
  PineconeRecord,
  RecordMetadata,
} from "@pinecone-database/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

let pineconeClient: Pinecone | null = null;
let anthropicClient: Anthropic | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return pineconeClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export interface RagChunk {
  id: string;
  content: string;
  score: number;
  metadata: {
    url: string;
    title: string;
    section: string;
  };
}

/**
 * Metadata shape stored in Pinecone per vector.
 * Extends RecordMetadata so it satisfies Pinecone's type constraint.
 * RecordMetadata = Record<string, string | number | boolean | string[]>
 */
interface ChunkMetadata extends RecordMetadata {
  content: string;
  url: string;
  title: string;
  section: string;
  websiteId: string;
}

export async function embedText(text: string): Promise<number[]> {
  const client = getAnthropic();

  const response = (await client.post("/v1/embeddings", {
    body: {
      model: "voyage-3",
      input: text,
      input_type: "query",
    },
  })) as { data: Array<{ embedding: number[] }> };

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Failed to generate embedding — empty response from API");
  }

  return embedding;
}

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
    .filter((match) => (match.score ?? 0) > 0.7)
    .map((match) => ({
      id: match.id,
      content: match.metadata?.content ?? "",
      score: match.score ?? 0,
      metadata: {
        url: match.metadata?.url ?? "",
        title: match.metadata?.title ?? "",
        section: match.metadata?.section ?? "",
      },
    }));
}

export async function indexContent(
  content: Array<{
    id: string;
    text: string;
    url: string;
    title: string;
    section: string;
  }>,
  websiteId: string,
): Promise<void> {
  const pc = getPinecone();
  const index = pc.index<ChunkMetadata>(env.PINECONE_INDEX);

  const BATCH_SIZE = 100;

  for (let i = 0; i < content.length; i += BATCH_SIZE) {
    const batch = content.slice(i, i + BATCH_SIZE);

    const records: PineconeRecord<ChunkMetadata>[] = await Promise.all(
      batch.map(async (chunk) => {
        const values = await embedText(chunk.text);
        return {
          id: chunk.id,
          values,
          metadata: {
            content: chunk.text,
            url: chunk.url,
            title: chunk.title,
            section: chunk.section,
            websiteId,
          },
        };
      }),
    );

    await index.namespace(websiteId).upsert({ records });
    console.log(
      `Indexed batch ${Math.floor(i / BATCH_SIZE) + 1} for ${websiteId}`,
    );
  }
}

export function formatContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";

  const formatted = chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}: ${chunk.metadata.title} — ${chunk.metadata.url}]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");

  return `RELEVANT CONTEXT FROM APPVIEWX WEBSITE:\n\n${formatted}\n\n---\n\nUse only the above context to answer. If the answer is not in the context, say you'll connect the user with the team.`;
}
