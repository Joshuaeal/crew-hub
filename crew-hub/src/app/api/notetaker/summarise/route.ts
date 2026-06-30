import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { readInstanceSettings } from "@/lib/instance-settings-store";

export async function POST(request: Request) {
  const gate = await requirePermission("notetaker");
  if (!gate.ok) return gate.response;

  let body: { transcript?: string; model?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.transcript?.trim()) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const settings = await readInstanceSettings();
  if (!settings.omlxUrl) {
    return NextResponse.json(
      { error: "omlx URL is not configured. Set it in Admin → Instance Settings." },
      { status: 503 }
    );
  }

  const model = body.model?.trim() || "llama3";
  const ollamaUrl = settings.omlxUrl.replace(/\/$/, "") + "/api/chat";

  const prompt = `You are a meeting notes assistant. Convert the following raw meeting transcript into structured Logseq-formatted markdown.

Use this format:
- A top-level heading with the meeting date/topic if determinable
- ## Attendees (if names are mentioned)
- ## Key Points — bullet list of main discussion points
- ## Decisions — bullet list of decisions made
- ## Action Items — bullet list with owner names if mentioned (format: - [ ] Action — Owner)
- ## Notes — any other relevant context

Keep it concise. Use Logseq page-link syntax [[Like This]] for names and topics where appropriate.

Transcript:
${body.transcript.trim()}`;

  try {
    const res = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `omlx returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      message?: { content?: string };
      error?: string;
    };

    const content = json.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: json.error ?? "Empty response from omlx" },
        { status: 502 }
      );
    }

    return NextResponse.json({ structured_content: content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to reach omlx";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
