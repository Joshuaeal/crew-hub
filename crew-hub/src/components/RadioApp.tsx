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
import { Mic, MicOff, Volume2, VolumeX, Radio, Users, ChevronDown } from "lucide-react";

type Channel = { label: string; room: string };
type Participant = { identity: string; speaking: boolean };

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
  const channels = parseChannels(radioChannels ?? undefined);

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [ptt, setPtt] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const pttRef = useRef(false);

  // Enumerate audio devices
  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        const inputs = all.filter((d) => d.kind === "audioinput");
        setDevices(inputs);
        if (inputs.length > 0 && !selectedDevice) {
          setSelectedDevice(inputs[0].deviceId);
        }
      })
      .catch(() => {});
  }, [selectedDevice]);

  const updateParticipants = useCallback((room: Room) => {
    const list: Participant[] = [];

    const addPart = (p: RemoteParticipant | LocalParticipant) => {
      list.push({ identity: p.identity, speaking: p.isSpeaking });
    };

    addPart(room.localParticipant);
    room.remoteParticipants.forEach((p) => addPart(p));
    setParticipants([...list]);
  }, []);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setActiveChannel(null);
    setParticipants([]);
    setConnectionState(ConnectionState.Disconnected);
  }, []);

  const connect = useCallback(
    async (channel: Channel) => {
      setError(null);
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
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

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          setConnectionState(state);
        });

        room.on(RoomEvent.ParticipantConnected, () => updateParticipants(room));
        room.on(RoomEvent.ParticipantDisconnected, () => updateParticipants(room));
        room.on(RoomEvent.ActiveSpeakersChanged, () => updateParticipants(room));

        // Set volume on remote audio tracks
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.volume = volume;
          }
        });

        await room.connect(serverUrl, token);
        updateParticipants(room);

        // Start muted — PTT controls when we transmit
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Connection failed");
        setConnectionState(ConnectionState.Disconnected);
        setActiveChannel(null);
        roomRef.current = null;
      }
    },
    [serverUrl, selectedDevice, username, volume, updateParticipants],
  );

  // PTT: enable mic while held, disable on release
  const startPtt = useCallback(async () => {
    if (!roomRef.current || pttRef.current) return;
    pttRef.current = true;
    setPtt(true);
    if (!muted) {
      try {
        const track = await createLocalAudioTrack({
          deviceId: selectedDevice || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        await roomRef.current.localParticipant.publishTrack(track);
      } catch {
        // mic permission denied
      }
    }
  }, [muted, selectedDevice]);

  const stopPtt = useCallback(async () => {
    if (!roomRef.current || !pttRef.current) return;
    pttRef.current = false;
    setPtt(false);
    await roomRef.current.localParticipant.setMicrophoneEnabled(false);
    // Unpublish all local audio tracks
    roomRef.current.localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track) {
        void roomRef.current?.localParticipant.unpublishTrack(pub.track);
      }
    });
  }, []);

  // Spacebar PTT
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && activeChannel) {
        e.preventDefault();
        void startPtt();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && activeChannel) {
        e.preventDefault();
        void stopPtt();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [activeChannel, startPtt, stopPtt]);

  // Volume change — update existing attached elements
  useEffect(() => {
    if (!roomRef.current) return;
    roomRef.current.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          pub.track.attachedElements.forEach((el) => {
            (el as HTMLAudioElement).volume = volume;
          });
        }
      });
    });
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  const connected = connectionState === ConnectionState.Connected;
  const connecting = connectionState === ConnectionState.Connecting;

  const stateColour =
    connected ? "bg-green-500" : connecting ? "bg-yellow-400 animate-pulse" : "bg-slate-600";

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Radio className="h-5 w-5 text-brand" />
        <h1 className="text-lg font-semibold text-white">Radio comms</h1>
        <span className={`ml-auto h-2.5 w-2.5 rounded-full ${stateColour}`} />
        <span className="text-xs text-slate-400">
          {connected ? `${activeChannel?.label}` : connecting ? "Connecting…" : "Off"}
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        {/* Channel list */}
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Channels
          </p>
          {channels.map((ch) => {
            const isActive = activeChannel?.room === ch.room;
            return (
              <button
                key={ch.room}
                type="button"
                onClick={() => {
                  if (isActive) {
                    void disconnect();
                  } else {
                    void connect(ch);
                  }
                }}
                disabled={connecting}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition disabled:opacity-50 ${
                  isActive
                    ? "bg-brand/20 text-brand ring-1 ring-brand/40"
                    : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${isActive && connected ? "bg-green-400" : isActive && connecting ? "bg-yellow-400 animate-pulse" : "bg-slate-600"}`}
                />
                {ch.label}
                {isActive && (
                  <span className="ml-auto text-xs text-slate-400">
                    {connected ? "connected" : "connecting…"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* PTT button */}
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Push to talk
            </p>
            <button
              type="button"
              onMouseDown={() => void startPtt()}
              onMouseUp={() => void stopPtt()}
              onTouchStart={(e) => { e.preventDefault(); void startPtt(); }}
              onTouchEnd={() => void stopPtt()}
              disabled={!connected || muted}
              className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all duration-75 disabled:opacity-30 ${
                ptt
                  ? "scale-95 bg-red-500 shadow-red-500/30 ring-4 ring-red-500/40"
                  : "bg-brand/80 hover:bg-brand"
              }`}
              aria-label="Push to talk"
            >
              {ptt ? <Mic className="h-8 w-8" /> : <MicOff className="h-8 w-8 opacity-60" />}
            </button>
            <p className="text-xs text-slate-500">Hold · or hold Space</p>
          </div>

          {/* Volume */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Receive volume
              </p>
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="text-slate-400 hover:text-white"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (v > 0) setMuted(false);
              }}
              className="w-full accent-brand"
              aria-label="Volume"
            />
          </div>

          {/* Device picker */}
          {devices.length > 1 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Mic / headset
              </p>
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

          {/* Participants */}
          {connected && participants.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  On channel ({participants.length})
                </p>
              </div>
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <div key={p.identity} className="flex items-center gap-2 text-xs">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${p.speaking ? "bg-green-400" : "bg-slate-600"}`}
                    />
                    <span className={p.speaking ? "text-white" : "text-slate-400"}>
                      {p.identity}
                    </span>
                    {p.speaking && (
                      <span className="ml-auto text-[10px] text-green-400">speaking</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!livekitUrl && (
        <p className="mt-auto rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          No LiveKit URL configured. Set one in Admin → Instance settings → LiveKit URL.
          Defaulting to <code className="font-mono">ws://localhost:7880</code>.
        </p>
      )}
    </div>
  );
}
