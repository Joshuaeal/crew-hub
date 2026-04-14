"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type RemoteParticipant,
  type LocalParticipant,
  ConnectionState,
} from "livekit-client";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Users,
  ChevronDown,
  Pencil,
  Check,
  X,
  SlidersHorizontal,
  FileText,
  Trash2,
} from "lucide-react";

type Channel = { label: string; room: string };
type Participant = { identity: string; speaking: boolean; isLocal: boolean };
type Segment = { id: string; speaker: string; text: string; ts: number; pending: boolean; error?: string };

const DEFAULT_CHANNELS: Channel[] = [
  { label: "Main", room: "radio-main" },
  { label: "Stage", room: "radio-stage" },
  { label: "Camera", room: "radio-camera" },
  { label: "Sound", room: "radio-sound" },
  { label: "Director", room: "radio-director" },
];

function parseChannels(raw: string[] | undefined): Channel[] {
  if (!raw || raw.length === 0) return DEFAULT_CHANNELS;
  return raw.map((s) => {
    const parts = s.split(":");
    if (parts.length === 2) return { label: parts[0].trim(), room: parts[1].trim() };
    const label = s.trim();
    return { label, room: `radio-${label.toLowerCase().replace(/\s+/g, "-")}` };
  });
}

function loadLabels(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("radio-channel-labels") ?? "{}") as Record<string, string>;
  } catch { return {}; }
}

function saveLabels(labels: Record<string, string>) {
  localStorage.setItem("radio-channel-labels", JSON.stringify(labels));
}

export function RadioApp({
  livekitUrl,
  radioChannels,
  username,
}: {
  livekitUrl?: string | null;
  radioChannels?: string[] | null;
  username?: string | null;
}) {
  const serverUrl = livekitUrl ?? "ws://localhost:7880";
  const baseChannels = parseChannels(radioChannels ?? undefined);

  // Channel labels (renamed by user, stored in localStorage)
  const [channelLabels, setChannelLabels] = useState<Record<string, string>>({});
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Connection state
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Audio
  const [pttMode, setPttMode] = useState(true);   // true = PTT, false = open mic
  const [ptt, setPtt] = useState(false);           // currently transmitting (PTT mode)
  const [txMuted, setTxMuted] = useState(false);   // mute own transmit (open mic mode)
  const [masterVolume, setMasterVolume] = useState(1);
  const [masterMuted, setMasterMuted] = useState(false);
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [showMixer, setShowMixer] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  const roomRef = useRef<Room | null>(null);
  const pttRef = useRef(false);
  // identity -> list of attached audio elements
  const audioElemsRef = useRef<Record<string, HTMLAudioElement[]>>({});

  // Transcription
  const [transcribeEnabled, setTranscribeEnabled] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [speakerLabel, setSpeakerLabel] = useState(username ?? "");
  const [chunkSecs, setChunkSecs] = useState(8);
  const [txAudioError, setTxAudioError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Load saved labels on mount
  useEffect(() => { setChannelLabels(loadLabels()); }, []);

  // Enumerate audio devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((all) => {
      const inputs = all.filter((d) => d.kind === "audioinput");
      setDevices(inputs);
      if (inputs.length > 0 && !selectedDevice) setSelectedDevice(inputs[0].deviceId);
    }).catch(() => {});
  }, [selectedDevice]);

  const getLabel = (ch: Channel) => channelLabels[ch.room] ?? ch.label;

  function commitRename(room: string) {
    const trimmed = editDraft.trim();
    if (trimmed) {
      const next = { ...channelLabels, [room]: trimmed };
      setChannelLabels(next);
      saveLabels(next);
    }
    setEditingRoom(null);
  }

  function setParticipantVolume(identity: string, vol: number) {
    setParticipantVolumes((prev) => ({ ...prev, [identity]: vol }));
    (audioElemsRef.current[identity] ?? []).forEach((el) => { el.volume = vol * masterVolume; });
  }

  const updateParticipants = useCallback((room: Room) => {
    const list: Participant[] = [];
    const addPart = (p: RemoteParticipant | LocalParticipant, isLocal: boolean) => {
      list.push({ identity: p.identity, speaking: p.isSpeaking, isLocal });
    };
    addPart(room.localParticipant, true);
    room.remoteParticipants.forEach((p) => addPart(p, false));
    setParticipants([...list]);
  }, []);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    // Detach all audio elements
    Object.values(audioElemsRef.current).flat().forEach((el) => {
      el.pause();
      el.remove();
    });
    audioElemsRef.current = {};
    setActiveChannel(null);
    setParticipants([]);
    setConnectionState(ConnectionState.Disconnected);
    setPtt(false);
    pttRef.current = false;
  }, []);

  const connect = useCallback(async (channel: Channel) => {
    setError(null);
    if (roomRef.current) {
      await roomRef.current.disconnect();
      audioElemsRef.current = {};
    }

    setConnectionState(ConnectionState.Connecting);
    setActiveChannel(channel);

    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: channel.room, identity: username }),
      });
      if (!res.ok) throw new Error("Failed to get token");
      const { token } = (await res.json()) as { token: string };

      const room = new Room({
        audioCaptureDefaults: {
          deviceId: selectedDevice || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => setConnectionState(state));
      room.on(RoomEvent.ParticipantConnected, () => updateParticipants(room));
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        // Clean up their audio elements
        (audioElemsRef.current[p.identity] ?? []).forEach((el) => { el.pause(); el.remove(); });
        delete audioElemsRef.current[p.identity];
        updateParticipants(room);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, () => updateParticipants(room));

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.style.display = "none";
          document.body.appendChild(el);
          const perVol = participantVolumes[participant.identity] ?? 1;
          el.volume = masterMuted ? 0 : perVol * masterVolume;
          audioElemsRef.current[participant.identity] = [
            ...(audioElemsRef.current[participant.identity] ?? []),
            el,
          ];
          updateParticipants(room);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => { el.pause(); el.remove(); });
          audioElemsRef.current[participant.identity] = [];
          updateParticipants(room);
        }
      });

      await room.connect(serverUrl, token);
      updateParticipants(room);

      if (pttMode) {
        // Start muted in PTT mode
        await room.localParticipant.setMicrophoneEnabled(false);
      } else {
        // Open mic — enable immediately unless tx muted
        if (!txMuted) await room.localParticipant.setMicrophoneEnabled(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setConnectionState(ConnectionState.Disconnected);
      setActiveChannel(null);
      roomRef.current = null;
    }
  }, [serverUrl, selectedDevice, username, pttMode, txMuted, masterVolume, masterMuted, participantVolumes, updateParticipants]);

  // PTT transmit controls
  const startPtt = useCallback(async () => {
    if (!roomRef.current || pttRef.current || !pttMode) return;
    pttRef.current = true;
    setPtt(true);
    if (!txMuted) {
      try {
        const track = await createLocalAudioTrack({
          deviceId: selectedDevice || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        await roomRef.current.localParticipant.publishTrack(track);
      } catch { /* mic permission denied */ }
    }
  }, [pttMode, txMuted, selectedDevice]);

  const stopPtt = useCallback(async () => {
    if (!roomRef.current || !pttRef.current) return;
    pttRef.current = false;
    setPtt(false);
    await roomRef.current.localParticipant.setMicrophoneEnabled(false);
    roomRef.current.localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track) void roomRef.current?.localParticipant.unpublishTrack(pub.track);
    });
  }, []);

  // Toggle tx mute in open mic mode
  const toggleTxMute = useCallback(async () => {
    if (!roomRef.current) { setTxMuted((m) => !m); return; }
    const next = !txMuted;
    setTxMuted(next);
    await roomRef.current.localParticipant.setMicrophoneEnabled(!next);
  }, [txMuted]);

  // Switch PTT mode while connected
  const togglePttMode = useCallback(async () => {
    const next = !pttMode;
    setPttMode(next);
    if (!roomRef.current) return;
    if (next) {
      // Switching to PTT — kill mic
      await roomRef.current.localParticipant.setMicrophoneEnabled(false);
      setPtt(false);
      pttRef.current = false;
    } else {
      // Switching to open mic — enable unless tx muted
      if (!txMuted) await roomRef.current.localParticipant.setMicrophoneEnabled(true);
    }
  }, [pttMode, txMuted]);

  // Transcription
  async function processChunk(blob: Blob) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const speaker = speakerLabel.trim() || "?";
    setSegments((prev) => [...prev, { id, speaker, text: "…", ts: Date.now(), pending: true }]);
    try {
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) {
        const msg = json.error ?? "Transcription failed";
        setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text: msg, pending: false, error: msg } : s));
        return;
      }
      const text = json.text.trim();
      if (!text) { setSegments((prev) => prev.filter((s) => s.id !== id)); return; }
      setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text, pending: false } : s));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text: msg, pending: false, error: msg } : s));
    }
  }

  async function startTranscribing() {
    setTxAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
      });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => { if (ev.data.size > 1000) void processChunk(ev.data); };
      recorder.start(chunkSecs * 1000);
      setTranscribeEnabled(true);
    } catch (err) {
      setTxAudioError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }

  function stopTranscribing() {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setTranscribeEnabled(false);
  }

  // Scroll transcript to bottom on new segments
  useEffect(() => {
    if (transcribeEnabled) transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, transcribeEnabled]);

  // Stop transcribing on unmount
  useEffect(() => { return () => { stopTranscribing(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Spacebar PTT (only in PTT mode)
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && activeChannel && pttMode) {
        e.preventDefault();
        void startPtt();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && activeChannel && pttMode) {
        e.preventDefault();
        void stopPtt();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [activeChannel, pttMode, startPtt, stopPtt]);

  // Master volume / mute changes
  useEffect(() => {
    Object.entries(audioElemsRef.current).forEach(([identity, els]) => {
      const perVol = participantVolumes[identity] ?? 1;
      els.forEach((el) => { el.volume = masterMuted ? 0 : perVol * masterVolume; });
    });
  }, [masterVolume, masterMuted, participantVolumes]);

  // Cleanup on unmount
  useEffect(() => { return () => { void disconnect(); }; }, [disconnect]);

  const connected = connectionState === ConnectionState.Connected;
  const connecting = connectionState === ConnectionState.Connecting;
  const remoteParticipants = participants.filter((p) => !p.isLocal);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Radio className="h-5 w-5 text-brand" />
        <h1 className="text-lg font-semibold text-white">Radio comms</h1>
        <span className={`ml-auto h-2.5 w-2.5 rounded-full ${connected ? "bg-green-500" : connecting ? "bg-yellow-400 animate-pulse" : "bg-slate-600"}`} />
        <span className="text-xs text-slate-400">
          {connected ? (channelLabels[activeChannel?.room ?? ""] ?? activeChannel?.label) : connecting ? "Connecting…" : "Off"}
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        {/* Channel list */}
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Channels</p>
          {baseChannels.map((ch) => {
            const isActive = activeChannel?.room === ch.room;
            const label = getLabel(ch);
            const isEditing = editingRoom === ch.room;

            return (
              <div
                key={ch.room}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive ? "bg-brand/20 ring-1 ring-brand/40" : "bg-white/5"
                }`}
              >
                {/* Connect/status dot */}
                <button
                  type="button"
                  onClick={() => { if (isActive) void disconnect(); else void connect(ch); }}
                  disabled={connecting}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left disabled:opacity-50"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${isActive && connected ? "bg-green-400" : isActive && connecting ? "bg-yellow-400 animate-pulse" : "bg-slate-600"}`} />
                  {isEditing ? (
                    <span className="font-medium text-slate-400 truncate">{label}</span>
                  ) : (
                    <span className={`font-medium truncate ${isActive ? "text-brand" : "text-slate-300"}`}>{label}</span>
                  )}
                  {isActive && !isEditing && (
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{connected ? "connected" : "connecting…"}</span>
                  )}
                </button>

                {/* Inline rename */}
                {isEditing ? (
                  <div className="flex items-center gap-1 ml-2">
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(ch.room);
                        if (e.key === "Escape") setEditingRoom(null);
                      }}
                      className="w-28 rounded bg-black/40 px-2 py-1 text-xs text-white outline-none ring-1 ring-brand/40"
                    />
                    <button type="button" onClick={() => commitRename(ch.room)} className="text-green-400 hover:text-green-300"><Check className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setEditingRoom(null)} className="text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingRoom(ch.room); setEditDraft(label); }}
                    className="ml-2 shrink-0 text-slate-600 hover:text-slate-300"
                    aria-label={`Rename ${label}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls panel */}
        <div className="space-y-3">
          {/* PTT mode toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-300">{pttMode ? "Push to talk" : "Open mic"}</p>
              <p className="text-[10px] text-slate-500">{pttMode ? "Hold button or Space" : "Mic always on"}</p>
            </div>
            <button
              type="button"
              onClick={() => void togglePttMode()}
              className={`relative h-6 w-11 rounded-full transition-colors ${pttMode ? "bg-brand/70" : "bg-slate-600"}`}
              aria-label="Toggle PTT mode"
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${pttMode ? "left-0.5" : "left-5"}`} />
            </button>
          </div>

          {/* PTT button (PTT mode) or tx mute (open mic mode) */}
          {pttMode ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <button
                type="button"
                onMouseDown={() => void startPtt()}
                onMouseUp={() => void stopPtt()}
                onTouchStart={(e) => { e.preventDefault(); void startPtt(); }}
                onTouchEnd={() => void stopPtt()}
                disabled={!connected}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all duration-75 disabled:opacity-30 ${
                  ptt ? "scale-95 bg-red-500 shadow-red-500/30 ring-4 ring-red-500/40" : "bg-brand/80 hover:bg-brand"
                }`}
                aria-label="Push to talk"
              >
                {ptt ? <Mic className="h-8 w-8" /> : <MicOff className="h-8 w-8 opacity-60" />}
              </button>
              <p className="text-xs text-slate-500">Hold · or hold Space</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-slate-300">Transmit</p>
              <button
                type="button"
                onClick={() => void toggleTxMute()}
                disabled={!connected}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-30 ${
                  txMuted ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30" : "bg-green-500/20 text-green-300 ring-1 ring-green-500/30"
                }`}
              >
                {txMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {txMuted ? "Muted" : "Live"}
              </button>
            </div>
          )}

          {/* Master volume */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Master receive</p>
              <button type="button" onClick={() => setMasterMuted((m) => !m)} className="text-slate-400 hover:text-white" aria-label={masterMuted ? "Unmute" : "Mute"}>
                {masterMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={masterMuted ? 0 : masterVolume}
              onChange={(e) => { const v = Number(e.target.value); setMasterVolume(v); if (v > 0) setMasterMuted(false); }}
              className="w-full accent-brand"
            />
          </div>

          {/* Mixer */}
          {connected && remoteParticipants.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <button
                type="button"
                onClick={() => setShowMixer((s) => !s)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Mixer ({remoteParticipants.length})
                  </p>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${showMixer ? "rotate-180" : ""}`} />
              </button>

              {showMixer && (
                <div className="mt-3 space-y-3">
                  {remoteParticipants.map((p) => {
                    const vol = participantVolumes[p.identity] ?? 1;
                    return (
                      <div key={p.identity}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${p.speaking ? "bg-green-400" : "bg-slate-600"}`} />
                          <span className={`text-xs truncate ${p.speaking ? "text-white" : "text-slate-400"}`}>{p.identity}</span>
                          <button
                            type="button"
                            onClick={() => setParticipantVolume(p.identity, vol > 0 ? 0 : 1)}
                            className="ml-auto shrink-0 text-slate-500 hover:text-white"
                          >
                            {vol === 0 ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                          </button>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.05}
                          value={vol}
                          onChange={(e) => setParticipantVolume(p.identity, Number(e.target.value))}
                          className="w-full accent-brand"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Participants (when mixer hidden) */}
          {connected && participants.length > 0 && !showMixer && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">On channel ({participants.length})</p>
              </div>
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <div key={p.identity} className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${p.speaking ? "bg-green-400" : "bg-slate-600"}`} />
                    <span className={p.speaking ? "text-white" : "text-slate-400"}>{p.identity}{p.isLocal ? " (you)" : ""}</span>
                    {p.speaking && <span className="ml-auto text-[10px] text-green-400">speaking</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device picker */}
          {devices.length > 1 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mic / headset</p>
              <div className="relative">
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full appearance-none rounded-lg bg-white/10 px-3 py-2 pr-8 text-xs text-white outline-none focus:ring-1 focus:ring-brand/50"
                >
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId} className="bg-slate-900">
                      {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}
        </div>
      </div>

      {!livekitUrl && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          No LiveKit URL configured. Set one in Admin → Instance settings → LiveKit URL.
          Defaulting to <code className="font-mono">ws://localhost:7880</code>.
        </p>
      )}

      {/* Transcription panel */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setTranscribeOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-300">Transcription</span>
            {transcribeEnabled && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/30">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                Live
              </span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${transcribeOpen ? "rotate-180" : ""}`} />
        </button>

        {transcribeOpen && (
          <div className="space-y-3 border-t border-white/10 p-4">
            {/* Controls row */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Speaker label
                </label>
                <input
                  value={speakerLabel}
                  onChange={(e) => setSpeakerLabel(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-brand/40"
                />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Chunk (sec)
                </label>
                <input
                  type="number"
                  min={4}
                  max={30}
                  value={chunkSecs}
                  onChange={(e) => setChunkSecs(Math.max(4, Math.min(30, Number(e.target.value))))}
                  disabled={transcribeEnabled}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-brand/40 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={() => { if (transcribeEnabled) stopTranscribing(); else void startTranscribing(); }}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                  transcribeEnabled
                    ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/30"
                    : "bg-brand/20 text-brand ring-1 ring-brand/30 hover:bg-brand/30"
                }`}
              >
                {transcribeEnabled ? "Stop" : "Start"}
              </button>
              {segments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSegments([])}
                  className="text-slate-500 hover:text-white"
                  aria-label="Clear transcript"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {txAudioError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {txAudioError}
              </p>
            )}

            {/* Transcript log */}
            {segments.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
                {segments.map((seg) => (
                  <div key={seg.id} className={`text-xs ${seg.error ? "text-red-400" : ""}`}>
                    <span className="mr-1.5 font-semibold text-brand/80">{seg.speaker}</span>
                    <span className="mr-2 text-slate-500">{new Date(seg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    <span className={seg.pending ? "italic text-slate-500" : "text-slate-200"}>{seg.text}</span>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            ) : (
              <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-6 text-center text-xs text-slate-600">
                {transcribeEnabled ? "Listening… transcript will appear here" : "Start transcription to begin capturing audio"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
