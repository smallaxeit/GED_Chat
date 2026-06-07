import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const system = `You are a genealogy research assistant. Answer questions about the family tree using only the data provided. Be specific — cite dates and places when available. If the data is insufficient to answer, say so clearly. Never invent individuals or relationships not in the data.

Format every answer in clean Markdown:
- Open with a one-sentence direct answer.
- Use a bulleted list when presenting several people or facts.
- Bold each person's name on first mention.
- Use a Markdown table when comparing multiple people across the same fields (e.g. birth/death years).
- Keep it concise; don't pad or repeat the question.

FAMILY TREE CONTEXT:
${JSON.stringify(context, null, 2)}`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    messages,
  });

  // Surface real errors (e.g. a missing ANTHROPIC_API_KEY) to the client
  // instead of the SDK's default opaque "An error occurred".
  return result.toDataStreamResponse({
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : "Something went wrong.",
  });
}
