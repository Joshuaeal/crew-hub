import { NextResponse } from "next/server";

const WHISPER_URL = (process.env.WHISPER_ASR_URL ?? "http://whisper-asr:9000").replace(/\/$/, "");

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "No audio blob in request" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("audio_file", audio, "audio.webm");

  let resp: Response;
  try {
    resp = await fetch(`${WHISPER_URL}/asr?encode=true&task=transcribe&output=txt`, {
      method: "POST",
      body: upstream,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unreachable";
    return NextResponse.json(
      { error: `Whisper ASR unreachable: ${msg}. Is the whisper-asr container running?` },
      { status: 503 },
    );
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return NextResponse.json(
      { error: `Whisper returned ${resp.status}${body ? `: ${body.slice(0, 200)}` : ""}` },
      { status: 502 },
    );
  }

  const text = (await resp.text()).trim();
  return NextResponse.json({ text });
}
