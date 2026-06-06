import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const system = `You are a genealogy research assistant. Answer questions about the family tree using only the data provided. Be specific — cite dates and places when available. If the data is insufficient to answer, say so clearly. Never invent individuals or relationships not in the data.

FAMILY TREE CONTEXT:
${JSON.stringify(context, null, 2)}`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    messages,
  });

  return result.toDataStreamResponse();
}
