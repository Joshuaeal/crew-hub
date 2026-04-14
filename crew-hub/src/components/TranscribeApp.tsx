"use client";

import {
  ClientEvent,
  createClient,
  MatrixError,
  type MatrixClient,
  type Room,
  RoomEvent,
  SyncState,
} from "matrix-js-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Mic, MicOff, Radio } from "lucide-react";
import {
  mxidDomainMismatchMessage,
  normalizeMatrixLoginIdentifier,
} from "@/lib/matrix-login";

type Props = {
  defaultHomeserver: string;
  matrixDomain: string;
  matrixUsesHubProxy: boolean;
};

type Segment = {
  id: string;
  text: string;
  ts: number;
  posted: boolean;
  error?: string;
};

function matrixLoginError(err: unknown, matrixDomain: string): string {
  if (err instanceof MatrixError && (err.errcode === "M_FORBIDDEN" || err.httpStatus === 403)) {
    return `Login rejected — wrong password, or this Matrix user does not exist. Use your Crew username (not email). MXID: @username:${matrixDomain}.`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network")) {
    return "Could not reach the homeserver. Check MATRIX_UPSTREAM_URL or set the homeserver to this Crew Hub URL.";
  }
  return msg || "Login failed.";
}

export function TranscribeApp({ defaultHomeserver, matrixDomain, matrixUsesHubProxy }: Props) {
  // Matrix state
  const [homeserver, setHomeserver] = useState(defaultHomeserver.replace(/\/$/, ""));
  const [localpart, setLocalpart] = useState("");
  const [password, setPassword] = useState("");
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [syncState, setSyncState] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Audio capture state
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [speakerLabel, setSpeakerLabel] = useState("");
  const [chunkSecs, setChunkSecs] = useState(8);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<MatrixClient | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  // Keep refs in sync so callbacks always have the latest values
  useEffect(() => { clientRef.current = client; }, [client]);
  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);

  const refreshRooms = useCallback((c: MatrixClient) => {
    setRooms(c.getRooms().filter((r) => r.getMyMembership() === "join"));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const domainErr = mxidDomainMismatchMessage(localpart, matrixDomain);
    if (domainErr) { setLoginError(domainErr); return; }
    setLoginBusy(true);
    try {
      const c = createClient({ baseUrl: homeserver });
      const user = normalizeMatrixLoginIdentifier(localpart);
      await c.login("m.login.password", {
        identifier: { type: "m.id.user", user },
        password,
        initial_device_display_name: "Crew Hub Transcribe",
      });
      c.on(ClientEvent.Sync, (state) => {
        setSyncState(state);
        refreshRooms(c);
      });
      c.on(RoomEvent.MyMembership, () => refreshRooms(c));
      c.startClient({ initialSyncLimit: 10 });
      setClient(c);
      setPassword("");
    } catch (err) {
      setLoginError(matrixLoginError(err, matrixDomain));
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    stopRecording();
    if (client) {
      try { await client.logout(); } catch { /* ignore */ }
      client.stopClient();
    }
    setClient(null);
    setRooms([]);
    setActiveRoomId(null);
    setSyncState("");
    setSegments([]);
  }

  // Enumerate audio input devices after mic permission is granted
  async function loadDevices() {
    try {
      // Requesting a short stream to trigger permission prompt before enumeration
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

  useEffect(() => {
    if (client) { loadDevices(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  async function startRecording() {
    if (!activeRoomIdRef.current) {
      setAudioError("Select a room first.");
      return;
    }
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

      recorder.ondataavailable = (ev) => {
        if (ev.data.size < 1000) return; // skip near-empty chunks (silence, end flush)
        void processChunk(ev.data);
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
    setSegments((prev) => [...prev, { id, text: "…", ts, posted: false }]);

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

      setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text } : s));

      // Post to Matrix room
      const c = clientRef.current;
      const roomId = activeRoomIdRef.current;
      if (c && roomId) {
        const label = speakerLabel.trim();
        const message = label ? `🎙️ ${label}: ${text}` : `🎙️ ${text}`;
        await c.sendTextMessage(roomId, message);
        setSegments((prev) => prev.map((s) => s.id === id ? { ...s, posted: true } : s));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Error";
      setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text: errMsg, error: errMsg } : s));
    }
  }

  // Cleanup on unmount
  useEffect(() => () => { stopRecording(); }, []);

  if (!client) {
    return (
      <div className="mx-auto flex min-h-0 flex-1 flex-col justify-center px-4 py-8 sm:max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Radio className="h-6 w-6 text-brand/90" aria-hidden />
          <h1 className="text-xl font-semibold text-white">Transcribe to channel</h1>
        </div>
        <p className="mb-6 text-sm text-slate-400">
          Sign in with your Matrix / Crew username to post voice transcripts into a room.
          Audio is transcribed on-server via Whisper — nothing leaves your network.
        </p>
        <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
          {loginError && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {loginError}
            </p>
          )}
          <div>
            <label className="text-sm text-slate-300">Homeserver base URL</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              required
            />
            {matrixUsesHubProxy && (
              <p className="mt-1 text-xs text-slate-500">
                Use this Crew Hub URL (same host/port as your browser bar).
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-slate-300">Crew username or Matrix ID</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={localpart}
              placeholder={`e.g. alex or @alex:${matrixDomain}`}
              onChange={(e) => setLocalpart(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loginBusy}
            className="w-full rounded-lg bg-brand/90 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {loginBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden /> : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  const activeRoom = rooms.find((r) => r.roomId === activeRoomId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="h-4 w-4 shrink-0 text-brand/80" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Transcribe</p>
            <p className="truncate text-xs text-slate-500">
              {syncState === SyncState.Syncing ? "Syncing…" : syncState || "Ready"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Log out
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row md:items-start">
        {/* Left: config panel */}
        <div className="w-full shrink-0 space-y-4 md:w-72">
          {/* Room picker */}
          <section className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Post to room
            </p>
            {rooms.length === 0 ? (
              <p className="text-xs text-slate-500">
                No rooms joined yet. Join rooms in{" "}
                <a href="/comms" className="text-brand/80 hover:underline">Channels</a> first.
              </p>
            ) : (
              <select
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                value={activeRoomId ?? ""}
                onChange={(e) => setActiveRoomId(e.target.value || null)}
              >
                <option value="">— Select a room —</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>
                    {r.name || r.roomId}
                  </option>
                ))}
              </select>
            )}
            {activeRoom && (
              <p className="mt-1 truncate text-[11px] text-slate-500">{activeRoom.roomId}</p>
            )}
          </section>

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
            <p className="mt-1.5 text-[10px] leading-snug text-slate-600">
              USB/Thunderbolt audio interfaces appear here automatically. For VDO.Ninja audio, route
              it to a virtual device (BlackHole / VB-Cable) and select that device above.
            </p>
          </section>

          {/* Options */}
          <section className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Options
            </p>
            <div className="space-y-2">
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
                <label className="text-xs text-slate-400">
                  Chunk interval: {chunkSecs}s
                </label>
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
                  Audio sent to Whisper every {chunkSecs}s. Longer = more context, more latency.
                </p>
              </div>
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
            disabled={!activeRoomId || devices.length === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition disabled:opacity-40 ${
              recording
                ? "animate-pulse bg-red-500/80 text-white hover:bg-red-500"
                : "bg-brand/90 text-slate-950 hover:bg-brand"
            }`}
          >
            {recording ? (
              <>
                <MicOff className="h-4 w-4" aria-hidden />
                Stop recording
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden />
                Start recording
              </>
            )}
          </button>
        </div>

        {/* Right: transcript log */}
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Transcript log
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
                      {seg.posted && !seg.error && (
                        <span className="ml-1 text-brand/60">✓</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
