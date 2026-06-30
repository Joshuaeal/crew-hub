"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mic, MicOff, Save, Sparkles, Trash2 } from "lucide-react";

type Segment = {
  id: string;
  text: string;
  ts: number;
  error?: string;
};

export function NotetakerTranscribeClient() {
  const router = useRouter();

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [recording, setRecording] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [speakerLabel, setSpeakerLabel] = useState("");
  const [chunkSecs, setChunkSecs] = useState(8);

  const [summarising, setSummarising] = useState(false);
  const [summariseError, setSummariseError] = useState<string | null>(null);
  const [structuredContent, setStructuredContent] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const headerChunkRef = useRef<Blob | null>(null);
  const chunkMimeRef = useRef<string>("audio/webm");

  async function loadDevices() {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter((d) => d.kind === "audioinput");
      setDevices(inputs);
      if (inputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(inputs[0]!.deviceId);
      }
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Microphone permission denied.");
    }
  }

  useEffect(() => { void loadDevices(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startRecording() {
    setAudioError(null);
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      headerChunkRef.current = null;
      chunkMimeRef.current = mimeType;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size < 500) return;
        if (!headerChunkRef.current) {
          // First chunk contains the webm header — store it and send it alone
          headerChunkRef.current = ev.data;
          void processChunk(ev.data);
        } else {
          // Subsequent chunks need the header prepended so Whisper can decode them
          const full = new Blob([headerChunkRef.current, ev.data], { type: chunkMimeRef.current });
          void processChunk(full);
        }
      };

      recorder.start(chunkSecs * 1000);
      setRecording(true);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Could not start recording.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  async function processChunk(blob: Blob) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ts = Date.now();
    setSegments((prev) => [...prev, { id, text: "…", ts }]);

    try {
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      const resp = await fetch("/api/transcribe", { method: "POST", body: form });
      const json = (await resp.json()) as { text?: string; error?: string };

      if (!resp.ok || !json.text) {
        const errMsg = json.error ?? "Transcription failed.";
        setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text: errMsg, error: errMsg } : s));
        return;
      }

      const text = json.text.trim();
      if (!text) {
        setSegments((prev) => prev.filter((s) => s.id !== id));
        return;
      }

      const label = speakerLabel.trim();
      setSegments((prev) =>
        prev.map((s) => s.id === id ? { ...s, text: label ? `${label}: ${text}` : text } : s)
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error";
      setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text: errMsg, error: errMsg } : s));
    }
  }

  useEffect(() => () => { stopRecording(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fullTranscript = segments
    .filter((s) => !s.error)
    .map((s) => `[${new Date(s.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] ${s.text}`)
    .join("\n");

  async function handleSummarise() {
    if (!fullTranscript.trim()) return;
    setSummariseError(null);
    setSummarising(true);
    try {
      const res = await fetch("/api/notetaker/summarise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullTranscript }),
      });
      const j = (await res.json()) as { structured_content?: string; error?: string };
      if (!res.ok) {
        setSummariseError(j.error ?? "Summarisation failed.");
        return;
      }
      setStructuredContent(j.structured_content ?? "");
    } catch {
      setSummariseError("Network error — could not reach omlx.");
    } finally {
      setSummarising(false);
    }
  }

  async function handleSave() {
    if (!fullTranscript.trim()) return;
    setSaveError(null);
    setSaving(true);

    const noteTitle = title.trim() ||
      `Meeting — ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;

    try {
      const res = await fetch("/api/notetaker/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle,
          transcript: fullTranscript,
          structured_content: structuredContent || fullTranscript,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setSaveError(j.error ?? "Failed to save");
        return;
      }
      const j = (await res.json()) as { note: { id: string } };
      router.push(`/notetaker/library/${j.note.id}`);
    } catch {
      setSaveError("Network error — could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-brand/80" aria-hidden />
          <span className="text-sm font-semibold text-white">Transcribe</span>
        </div>
        <Link href="/notetaker" className="text-sm text-brand/90 hover:text-brand/80">
          ← Notetaker
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row md:items-start">
        {/* Left: config */}
        <div className="w-full shrink-0 space-y-4 md:w-72">
          {/* Audio source */}
          <section className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Audio source
            </p>
            {devices.length === 0 ? (
              <button
                type="button"
                onClick={() => void loadDevices()}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-slate-300 hover:bg-white/10"
              >
                Allow microphone access
              </button>
            ) : (
              <select
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                disabled={recording}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Device ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Options */}
          <section className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Options
            </p>
            <div>
              <label className="text-xs text-slate-400">Speaker label (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-slate-600"
                placeholder="e.g. Director"
                value={speakerLabel}
                onChange={(e) => setSpeakerLabel(e.target.value)}
                disabled={recording}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Chunk interval: {chunkSecs}s</label>
              <input
                type="range"
                min={4}
                max={30}
                step={2}
                value={chunkSecs}
                onChange={(e) => setChunkSecs(Number(e.target.value))}
                disabled={recording}
                className="mt-1 w-full accent-brand/90"
              />
              <p className="text-[10px] text-slate-600">
                Audio sent to Whisper every {chunkSecs}s.
              </p>
            </div>
          </section>

          {/* Record button */}
          {audioError && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {audioError}
            </p>
          )}
          <button
            type="button"
            onClick={() => { if (recording) { stopRecording(); } else { void startRecording(); } }}
            disabled={devices.length === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition disabled:opacity-40 ${
              recording
                ? "animate-pulse bg-red-500/80 text-white hover:bg-red-500"
                : "bg-brand/90 text-slate-950 hover:bg-brand"
            }`}
          >
            {recording ? (
              <><MicOff className="h-4 w-4" aria-hidden />Stop recording</>
            ) : (
              <><Mic className="h-4 w-4" aria-hidden />Start recording</>
            )}
          </button>

          {/* Save */}
          {segments.length > 0 && !recording && (
            <section className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Save as note
              </p>
              <input
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-slate-600"
                placeholder={`Meeting — ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {summariseError && <p className="text-xs text-red-400">{summariseError}</p>}
              <button
                type="button"
                onClick={() => void handleSummarise()}
                disabled={summarising || saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand/30 bg-brand/10 py-2 text-sm font-medium text-brand/90 hover:bg-brand/20 disabled:opacity-50 transition"
              >
                {summarising ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <><Sparkles className="h-4 w-4" aria-hidden />Summarise with omlx</>
                )}
              </button>
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || summarising}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand/90 py-2 text-sm font-semibold text-slate-950 hover:bg-brand disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <><Save className="h-4 w-4" aria-hidden />{structuredContent ? "Save to library" : "Save raw transcript"}</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setSegments([]); setStructuredContent(""); }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 text-xs text-slate-500 hover:text-red-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Discard transcript
              </button>
            </section>
          )}
        </div>

        {/* Right: transcript + summary */}
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Transcript
            </p>
            {segments.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-sm text-slate-600">
                {recording ? "Listening…" : "Transcripts will appear here when recording starts."}
              </div>
            ) : (
              <div className="space-y-2">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      seg.error
                        ? "border border-red-500/30 bg-red-500/10 text-red-200"
                        : "bg-white/5 text-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap">{seg.text}</p>
                      <span className="shrink-0 text-[10px] text-slate-600">
                        {new Date(seg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(structuredContent || summarising) && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Structured Notes
              </p>
              {summarising ? (
                <div className="flex h-24 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Summarising…
                </div>
              ) : (
                <textarea
                  className="w-full rounded-xl border border-brand/20 bg-black/30 px-4 py-3 font-mono text-sm text-slate-200 outline-none focus:ring-1 focus:ring-brand/40 resize-y min-h-[16rem]"
                  value={structuredContent}
                  onChange={(e) => setStructuredContent(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
