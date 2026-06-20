"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  LocalAudioTrack,
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
  Plus,
  Phone,
  PhoneOff,
} from "lucide-react";

type Channel = { label: string; room: string; isCustom?: boolean };
type Participant = { identity: string; speaking: boolean; isLocal: boolean };
type Segment = { id: string; speaker: string; text: string; ts: number; pending: boolean; error?: string };

const DEFAULT_CHANNELS: Channel[] = [
  { label: "Main", room: "radio-main" },
  { label: "Stage", room: "radio-stage" },
  { label: "Camera", room: "radio-camera" },
  { label: "Sound", room: "radio-sound" },
  { label: "Director", room: "radio-director" },
];

const CUSTOM_CHANNELS_KEY = "radio-custom-channels";
const LABELS_KEY = "radio-channel-labels";

function parseServerChannels(raw: string[] | undefined): Channel[] {
  if (!raw || raw.length === 0) return DEFAULT_CHANNELS;
  return raw.map((s) => {
    const parts = s.split(":");
    if (parts.length === 2) return { label: parts[0].trim(), room: parts[1].trim() };
    const label = s.trim();
    return { label, room: `radio-${label.toLowerCase().replace(/\s+/g, "-")}` };
  });
}

function loadLabels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LABELS_KEY) ?? "{}") as Record<string, string>; }
  catch { return {}; }
}

function saveLabels(labels: Record<string, string>) {
  localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
}

function loadCustomChannels(): Channel[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CHANNELS_KEY) ?? "[]") as Channel[]; }
  catch { return []; }
}

function saveCustomChannels(chs: Channel[]) {
  localStorage.setItem(CUSTOM_CHANNELS_KEY, JSON.stringify(chs));
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
  const baseChannels = parseServerChannels(radioChannels ?? undefined);

  // Channels
  const [customChannels, setCustomChannels] = useState<Channel[]>([]);
  const [channelLabels, setChannelLabels] = useState<Record<string, string>>({});
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  // Multi-room connection state
  // roomId -> Room instance
  const roomsRef = useRef<Map<string, Room>>(new Map());
  // `${roomId}:::${identity}` -> HTMLAudioElement[]
  const audioElemsRef = useRef<Map<string, HTMLAudioElement[]>>(new Map());
  const [connectedRooms, setConnectedRooms] = useState<Set<string>>(new Set());
  const [roomStates, setRoomStates] = useState<Map<string, ConnectionState>>(new Map());
  const [roomParticipants, setRoomParticipants] = useState<Map<string, Participant[]>>(new Map());
  // Which room PTT/open-mic transmits on
  const [transmitRoomId, setTransmitRoomId] = useState<string | null>(null);
  const transmitRoomIdRef = useRef<string | null>(null);
  useEffect(() => { transmitRoomIdRef.current = transmitRoomId; }, [transmitRoomId]);

  // PTT / open mic
  const [pttMode, setPttMode] = useState(true);
  const [ptt, setPtt] = useState(false);
  const [txMuted, setTxMuted] = useState(false);
  const pttRef = useRef(false);
  const txMutedRef = useRef(false);
  useEffect(() => { txMutedRef.current = txMuted; }, [txMuted]);

  // Volume
  const [masterVolume, setMasterVolume] = useState(1);
  const [masterMuted, setMasterMuted] = useState(false);
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [showMixer, setShowMixer] = useState(false);

  // Devices
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedExt, setSelectedExt] = useState<string>("");
  const [useExtInput, setUseExtInput] = useState(false);
  const selectedMicRef = useRef<string>("");
  const selectedExtRef = useRef<string>("");
  const useExtInputRef = useRef(false);
  useEffect(() => { selectedMicRef.current = selectedMic; }, [selectedMic]);
  useEffect(() => { selectedExtRef.current = selectedExt; }, [selectedExt]);
  useEffect(() => { useExtInputRef.current = useExtInput; }, [useExtInput]);

  // Audio context for mixing two inputs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mixedDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const primaryStreamRef = useRef<MediaStream | null>(null);
  const extStreamRef = useRef<MediaStream | null>(null);
  const publishedTrackRef = useRef<LocalAudioTrack | null>(null);

  // Speaker name (prominent, used in transcript)
  const [speakerName, setSpeakerName] = useState(username ?? "");
  const speakerNameRef = useRef(username ?? "");
  useEffect(() => { speakerNameRef.current = speakerName; }, [speakerName]);

  // Transcription — one MediaRecorder per participant so each segment is labelled correctly
  const [transcribeEnabled, setTranscribeEnabled] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [chunkSecs, setChunkSecs] = useState(8);
  const [txAudioError, setTxAudioError] = useState<string | null>(null);
  // identity -> MediaRecorder for that participant
  const txRecordersRef = useRef<Map<string, MediaRecorder>>(new Map());
  // local mic stream (stopped on end)
  const txMicStreamRef = useRef<MediaStream | null>(null);
  const transcribeEnabledRef = useRef(false);
  const chunkSecsRef = useRef(8);
  useEffect(() => { transcribeEnabledRef.current = transcribeEnabled; }, [transcribeEnabled]);
  useEffect(() => { chunkSecsRef.current = chunkSecs; }, [chunkSecs]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Connection errors per room
  const [roomErrors, setRoomErrors] = useState<Map<string, string>>(new Map());

  // Load from localStorage on mount
  useEffect(() => {
    setChannelLabels(loadLabels());
    setCustomChannels(loadCustomChannels().map((c) => ({ ...c, isCustom: true })));
    setChannelsLoaded(true);
  }, []);

  // Auto-connect all channels on load
  useEffect(() => {
    if (!channelsLoaded) return;
    [...baseChannels, ...customChannels].forEach((ch) => void connectRoom(ch));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelsLoaded]);

  // Enumerate audio devices — must request mic permission first so mobile returns all devices with labels
  useEffect(() => {
    const enumerate = () => {
      navigator.mediaDevices.enumerateDevices().then((all) => {
        const inputs = all.filter((d) => d.kind === "audioinput");
        setDevices(inputs);
        if (inputs.length > 0) {
          setSelectedMic((prev) => prev || inputs[0].deviceId);
          setSelectedExt((prev) => prev || inputs[0].deviceId);
        }
      }).catch(() => {});
    };

    // Request permission first so mobile browsers expose all device labels
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        enumerate();
      })
      .catch(() => enumerate()); // fallback: enumerate without permission

    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => navigator.mediaDevices.removeEventListener("devicechange", enumerate);
  }, []);

  const allChannels = [...baseChannels, ...customChannels];

  const getLabel = (ch: Channel) => channelLabels[ch.room] ?? ch.label;

  function commitRename(roomId: string) {
    const trimmed = editDraft.trim();
    if (trimmed) {
      const next = { ...channelLabels, [roomId]: trimmed };
      setChannelLabels(next);
      saveLabels(next);
    }
    setEditingRoom(null);
  }

  function addCustomChannel() {
    const name = newChannelName.trim();
    if (!name) return;
    const roomId = `radio-custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    const ch: Channel = { label: name, room: roomId, isCustom: true };
    const next = [...customChannels, ch];
    setCustomChannels(next);
    saveCustomChannels(next);
    void connectRoom(ch);
    setNewChannelName("");
    setAddingChannel(false);
  }

  // Per-participant volume control
  function setParticipantVolume(identity: string, vol: number) {
    setParticipantVolumes((prev) => ({ ...prev, [identity]: vol }));
    audioElemsRef.current.forEach((els, key) => {
      if (key.endsWith(`:::${identity}`)) {
        els.forEach((el) => { el.volume = masterMuted ? 0 : vol * masterVolume; });
      }
    });
  }

  // Update participants state for a room
  const updateRoomParticipants = useCallback((roomId: string, room: Room) => {
    const list: Participant[] = [];
    const addPart = (p: RemoteParticipant | LocalParticipant, isLocal: boolean) => {
      list.push({ identity: p.identity, speaking: p.isSpeaking, isLocal });
    };
    addPart(room.localParticipant, true);
    room.remoteParticipants.forEach((p) => addPart(p, false));
    setRoomParticipants((prev) => {
      const next = new Map(prev);
      next.set(roomId, list);
      return next;
    });
  }, []);

  // Build a (possibly mixed) audio stream for transmitting
  async function buildTxStream(): Promise<MediaStream> {
    const mic = selectedMicRef.current;
    const ext = selectedExtRef.current;
    const useExt = useExtInputRef.current;

    const primaryStream = await navigator.mediaDevices.getUserMedia({
      audio: mic ? { deviceId: { exact: mic }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: true, noiseSuppression: true },
    });
    primaryStreamRef.current = primaryStream;

    if (!useExt || !ext || ext === mic) {
      return primaryStream;
    }

    // Mix primary mic + external input via Web Audio API
    const extStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: ext } },
    });
    extStreamRef.current = extStream;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const dest = ctx.createMediaStreamDestination();
    mixedDestRef.current = dest;

    ctx.createMediaStreamSource(primaryStream).connect(dest);
    ctx.createMediaStreamSource(extStream).connect(dest);

    return dest.stream;
  }

  function teardownTxAudio() {
    if (publishedTrackRef.current) {
      publishedTrackRef.current.stop();
      publishedTrackRef.current = null;
    }
    primaryStreamRef.current?.getTracks().forEach((t) => t.stop());
    extStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    mixedDestRef.current = null;
    primaryStreamRef.current = null;
    extStreamRef.current = null;
  }

  // Connect to a LiveKit room (add to multi-room set)
  const connectRoom = useCallback(async (channel: Channel) => {
    const { room: roomId } = channel;
    if (roomsRef.current.has(roomId)) return;

    setRoomErrors((prev) => { const next = new Map(prev); next.delete(roomId); return next; });
    setRoomStates((prev) => { const next = new Map(prev); next.set(roomId, ConnectionState.Connecting); return next; });

    try {
      // Pre-warm audio context — iOS WebKit requires getUserMedia within a user gesture
      // before WebRTC ICE can establish, even in PTT (receive-only) mode.
      void navigator.mediaDevices.getUserMedia({ audio: true })
        .then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => {});

      const identity = speakerNameRef.current.trim() || username || "user";
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, identity }),
      });
      if (!res.ok) throw new Error(`Token error ${res.status}`);
      const { token } = (await res.json()) as { token: string };

      const room = new Room({
        audioCaptureDefaults: {
          deviceId: selectedMicRef.current || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      roomsRef.current.set(roomId, room);

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setRoomStates((prev) => { const next = new Map(prev); next.set(roomId, state); return next; });
        if (state === ConnectionState.Connected) {
          setConnectedRooms((prev) => { const n = new Set(prev); n.add(roomId); return n; });
        } else if (state === ConnectionState.Disconnected) {
          setConnectedRooms((prev) => { const n = new Set(prev); n.delete(roomId); return n; });
          roomsRef.current.delete(roomId);
          setRoomParticipants((prev) => { const n = new Map(prev); n.delete(roomId); return n; });
          if (transmitRoomIdRef.current === roomId) {
            setTransmitRoomId(null);
            setPtt(false);
            pttRef.current = false;
          }
        }
      });

      room.on(RoomEvent.ParticipantConnected, () => updateRoomParticipants(roomId, room));
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        const key = `${roomId}:::${p.identity}`;
        (audioElemsRef.current.get(key) ?? []).forEach((el) => { el.pause(); el.remove(); });
        audioElemsRef.current.delete(key);
        updateRoomParticipants(roomId, room);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, () => updateRoomParticipants(roomId, room));

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.style.display = "none";
          document.body.appendChild(el);
          const key = `${roomId}:::${participant.identity}`;
          const perVol = participantVolumes[participant.identity] ?? 1;
          el.volume = masterMuted ? 0 : perVol * masterVolume;
          const existing = audioElemsRef.current.get(key) ?? [];
          audioElemsRef.current.set(key, [...existing, el]);
          updateRoomParticipants(roomId, room);
          // Auto-start per-participant recording if transcription is already running
          if (transcribeEnabledRef.current && el.srcObject instanceof MediaStream) {
            startParticipantRecorder(participant.identity, el.srcObject as MediaStream);
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => { el.pause(); el.remove(); });
          audioElemsRef.current.set(`${roomId}:::${participant.identity}`, []);
          updateRoomParticipants(roomId, room);
          // Stop this participant's recorder when their track is removed
          stopParticipantRecorder(participant.identity);
        }
      });

      await room.connect(serverUrl, token);
      // Start muted — user controls TX via PTT button or open-mic toggle
      await room.localParticipant.setMicrophoneEnabled(false);
      updateRoomParticipants(roomId, room);

      // Auto-select first connected room as transmit channel
      if (!transmitRoomIdRef.current) {
        setTransmitRoomId(roomId);
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setRoomErrors((prev) => { const next = new Map(prev); next.set(roomId, msg); return next; });
      setRoomStates((prev) => { const next = new Map(prev); next.delete(roomId); return next; });
      roomsRef.current.delete(roomId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, username, updateRoomParticipants]);

  // Disconnect from one room
  const disconnectRoom = useCallback(async (roomId: string) => {
    const room = roomsRef.current.get(roomId);
    if (room) {
      await room.disconnect();
      roomsRef.current.delete(roomId);
    }
    // Clean up audio elements for this room
    const keysToDelete: string[] = [];
    audioElemsRef.current.forEach((els, key) => {
      if (key.startsWith(`${roomId}:::`)) {
        els.forEach((el) => { el.pause(); el.remove(); });
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((k) => audioElemsRef.current.delete(k));

    setConnectedRooms((prev) => { const n = new Set(prev); n.delete(roomId); return n; });
    setRoomStates((prev) => { const n = new Map(prev); n.delete(roomId); return n; });
    setRoomParticipants((prev) => { const n = new Map(prev); n.delete(roomId); return n; });
    setRoomErrors((prev) => { const n = new Map(prev); n.delete(roomId); return n; });

    if (transmitRoomIdRef.current === roomId) {
      setTransmitRoomId(null);
      setPtt(false);
      pttRef.current = false;
      teardownTxAudio();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function deleteCustomChannel(roomId: string) {
    void disconnectRoom(roomId);
    const next = customChannels.filter((c) => c.room !== roomId);
    setCustomChannels(next);
    saveCustomChannels(next);
  }

  // PTT: transmit on the selected transmit channel
  const startPtt = useCallback(async () => {
    const txRoom = transmitRoomIdRef.current;
    if (!txRoom || pttRef.current) return;
    const room = roomsRef.current.get(txRoom);
    if (!room) return;
    pttRef.current = true;
    setPtt(true);
    if (!txMutedRef.current) {
      try {
        const stream = await buildTxStream();
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;
        const livekitTrack = new LocalAudioTrack(audioTrack, undefined, true);
        publishedTrackRef.current = livekitTrack;
        await room.localParticipant.publishTrack(livekitTrack);
      } catch { /* mic denied */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPtt = useCallback(async () => {
    if (!pttRef.current) return;
    pttRef.current = false;
    setPtt(false);
    const txRoom = transmitRoomIdRef.current;
    if (txRoom) {
      const room = roomsRef.current.get(txRoom);
      if (room && publishedTrackRef.current) {
        try { await room.localParticipant.unpublishTrack(publishedTrackRef.current); } catch { /* ok */ }
      }
    }
    teardownTxAudio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle TX mute in open-mic mode
  const toggleTxMute = useCallback(async () => {
    const next = !txMutedRef.current;
    setTxMuted(next);
    const txRoom = transmitRoomIdRef.current;
    if (txRoom) {
      const room = roomsRef.current.get(txRoom);
      if (room) await room.localParticipant.setMicrophoneEnabled(!next);
    }
  }, []);

  // Switch between PTT and open-mic modes
  const togglePttMode = useCallback(async (next: boolean) => {
    setPttMode(next);
    const txRoom = transmitRoomIdRef.current;
    if (!txRoom) return;
    const room = roomsRef.current.get(txRoom);
    if (!room) return;
    if (next) {
      // Switching to PTT — kill mic
      if (publishedTrackRef.current) {
        try { await room.localParticipant.unpublishTrack(publishedTrackRef.current); } catch { /* ok */ }
      }
      teardownTxAudio();
      await room.localParticipant.setMicrophoneEnabled(false);
      setPtt(false);
      pttRef.current = false;
    } else {
      // Switching to open mic — enable unless muted
      if (!txMutedRef.current) await room.localParticipant.setMicrophoneEnabled(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When transmit channel changes in open-mic mode, update mic state
  useEffect(() => {
    if (!transmitRoomId) return;
    // No-op for PTT mode — mic managed by button
  }, [transmitRoomId]);

  // Spacebar PTT
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && transmitRoomIdRef.current && pttMode) {
        e.preventDefault();
        void startPtt();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && transmitRoomIdRef.current && pttMode) {
        e.preventDefault();
        void stopPtt();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [pttMode, startPtt, stopPtt]);

  // Master volume / mute sync to audio elements
  useEffect(() => {
    audioElemsRef.current.forEach((els, key) => {
      const identity = key.split(":::")[1] ?? "";
      const perVol = participantVolumes[identity] ?? 1;
      els.forEach((el) => { el.volume = masterMuted ? 0 : perVol * masterVolume; });
    });
  }, [masterVolume, masterMuted, participantVolumes]);

  // Transcription — each participant gets their own MediaRecorder so speaker labels are accurate
  async function processChunk(blob: Blob, identity: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setSegments((prev) => [...prev, { id, speaker: identity, text: "…", ts: Date.now(), pending: true }]);
    try {
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      // Guard against HTML error pages (e.g. 404, Next.js error, Whisper unreachable)
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        const body = await res.text();
        const msg = body.includes("<!") || body.includes("<html")
          ? "Whisper ASR not available — check that the whisper-asr service is running"
          : body.slice(0, 120) || `HTTP ${res.status}`;
        setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text: msg, pending: false, error: msg } : s));
        return;
      }
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

  // Start a per-participant recorder. Skips if that identity already has one.
  function startParticipantRecorder(identity: string, stream: MediaStream) {
    if (txRecordersRef.current.has(identity)) return;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus" : "audio/webm";
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, { mimeType }); }
    catch { return; } // stream may not be recordable
    recorder.ondataavailable = (ev) => { if (ev.data.size > 1000) void processChunk(ev.data, identity); };
    recorder.start(chunkSecsRef.current * 1000);
    txRecordersRef.current.set(identity, recorder);
  }

  function stopParticipantRecorder(identity: string) {
    const rec = txRecordersRef.current.get(identity);
    if (rec && rec.state !== "inactive") rec.stop();
    txRecordersRef.current.delete(identity);
  }

  async function startTranscribing() {
    setTxAudioError(null);
    try {
      // Local mic — keyed by the user's chosen speaker name
      const localName = speakerNameRef.current.trim() || username || "Me";
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicRef.current ? { deviceId: { exact: selectedMicRef.current } } : true,
      });
      txMicStreamRef.current = micStream;
      startParticipantRecorder(localName, micStream);

      // One recorder per remote participant, keyed by their LiveKit identity
      // audioElemsRef keys: `${roomId}:::${identity}` — deduplicate by identity
      const seenTx = new Set<string>();
      audioElemsRef.current.forEach((els, key) => {
        const identity = key.split(":::")[1];
        if (!identity || seenTx.has(identity)) return;
        seenTx.add(identity);
        for (const el of els) {
          if (el.srcObject instanceof MediaStream) {
            startParticipantRecorder(identity, el.srcObject as MediaStream);
            break; // one stream per identity is enough
          }
        }
      });

      setTranscribeEnabled(true);
    } catch (err) {
      setTxAudioError(err instanceof Error ? err.message : "Microphone access denied");
      stopTranscribing();
    }
  }

  function stopTranscribing() {
    txRecordersRef.current.forEach((rec) => { if (rec.state !== "inactive") rec.stop(); });
    txRecordersRef.current.clear();
    txMicStreamRef.current?.getTracks().forEach((t) => t.stop());
    txMicStreamRef.current = null;
    setTranscribeEnabled(false);
  }

  useEffect(() => {
    if (transcribeEnabled) transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, transcribeEnabled]);

  useEffect(() => { return () => { stopTranscribing(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup all rooms on unmount
  useEffect(() => {
    const rooms = roomsRef.current;
    const audioElems = audioElemsRef.current;
    return () => {
      rooms.forEach((room) => { void room.disconnect(); });
      audioElems.forEach((els) => els.forEach((el) => { el.pause(); el.remove(); }));
      teardownTxAudio();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const anyConnected = connectedRooms.size > 0;

  // Collect unique remote participants across all rooms for mixer
  const allRemoteParticipants: Participant[] = [];
  const seenIdentities = new Set<string>();
  roomParticipants.forEach((parts) => {
    parts.filter((p) => !p.isLocal).forEach((p) => {
      if (!seenIdentities.has(p.identity)) {
        seenIdentities.add(p.identity);
        allRemoteParticipants.push(p);
      }
    });
  });

  const transmitChannel = allChannels.find((c) => c.room === transmitRoomId);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Radio className="h-5 w-5 text-brand" />
        <h1 className="text-lg font-semibold text-white">Radio comms</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${anyConnected ? "bg-green-500" : "bg-slate-600"}`} />
          <span className="text-xs text-slate-400">
            {connectedRooms.size > 0
              ? `${connectedRooms.size} channel${connectedRooms.size > 1 ? "s" : ""} live`
              : "Off"}
          </span>
        </div>
      </div>

      {/* Speaker name — prominent, auto-filled from username */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Your name
        </label>
        <input
          value={speakerName}
          onChange={(e) => setSpeakerName(e.target.value)}
          placeholder={username ?? "Enter your display name"}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-brand/40"
        />
        <p className="mt-1 text-[10px] text-slate-600">Used as your identity on all channels and in the transcript.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        {/* Channel list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Channels</p>
            <button
              type="button"
              onClick={() => setAddingChannel((a) => !a)}
              className="text-slate-500 hover:text-white transition"
              aria-label="Add channel"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {addingChannel && (
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomChannel();
                  if (e.key === "Escape") { setAddingChannel(false); setNewChannelName(""); }
                }}
                placeholder="Channel name…"
                className="flex-1 rounded bg-black/40 px-2 py-1 text-xs text-white outline-none ring-1 ring-brand/40"
              />
              <button type="button" onClick={addCustomChannel} className="text-green-400 hover:text-green-300">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => { setAddingChannel(false); setNewChannelName(""); }} className="text-slate-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {allChannels.map((ch) => {
            const isConnected = connectedRooms.has(ch.room);
            const state = roomStates.get(ch.room);
            const isConnecting = state === ConnectionState.Connecting;
            const isTransmit = transmitRoomId === ch.room;
            const label = getLabel(ch);
            const isEditing = editingRoom === ch.room;
            const parts = roomParticipants.get(ch.room) ?? [];
            const remoteCount = parts.filter((p) => !p.isLocal).length;
            const errMsg = roomErrors.get(ch.room);

            return (
              <div
                key={ch.room}
                className={`flex flex-col gap-1.5 rounded-xl px-3 py-2.5 text-sm transition ${
                  isTransmit
                    ? "bg-brand/20 ring-1 ring-brand/40"
                    : isConnected
                    ? "bg-white/5 ring-1 ring-white/10"
                    : "bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Join / Leave */}
                  <button
                    type="button"
                    onClick={() => { if (isConnected) void disconnectRoom(ch.room); else void connectRoom(ch); }}
                    disabled={isConnecting}
                    className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-50 ${
                      isConnected
                        ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                        : "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                    }`}
                    aria-label={isConnected ? "Leave channel" : "Join channel"}
                  >
                    {isConnecting ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : isConnected ? (
                      <PhoneOff className="h-3.5 w-3.5" />
                    ) : (
                      <Phone className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    isConnected ? "bg-green-400" : isConnecting ? "bg-yellow-400 animate-pulse" : "bg-slate-600"
                  }`} />

                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        autoFocus
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(ch.room);
                          if (e.key === "Escape") setEditingRoom(null);
                        }}
                        className="flex-1 rounded bg-black/40 px-2 py-0.5 text-xs text-white outline-none ring-1 ring-brand/40"
                      />
                      <button type="button" onClick={() => commitRename(ch.room)} className="text-green-400 hover:text-green-300">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingRoom(null)} className="text-slate-500 hover:text-white">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className={`flex-1 font-medium truncate ${
                        isTransmit ? "text-brand" : isConnected ? "text-slate-200" : "text-slate-400"
                      }`}>
                        {label}
                      </span>
                      {isConnected && remoteCount > 0 && (
                        <span className="shrink-0 text-[10px] text-slate-500">
                          <Users className="inline h-2.5 w-2.5 mr-0.5" />{remoteCount}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditingRoom(ch.room); setEditDraft(label); }}
                        className="shrink-0 text-slate-600 hover:text-slate-300 transition"
                        aria-label={`Rename ${label}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {ch.isCustom && (
                        <button
                          type="button"
                          onClick={() => deleteCustomChannel(ch.room)}
                          className="shrink-0 text-slate-600 hover:text-red-400 transition"
                          aria-label={`Delete ${label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Transmit channel selector (shown when connected, multiple rooms active) */}
                {isConnected && !isTransmit && connectedRooms.size > 1 && (
                  <button
                    type="button"
                    onClick={() => setTransmitRoomId(ch.room)}
                    className="ml-9 text-left text-[10px] text-slate-500 hover:text-brand transition"
                  >
                    Set as transmit channel
                  </button>
                )}
                {isConnected && isTransmit && connectedRooms.size > 1 && (
                  <span className="ml-9 text-[10px] text-brand/70">Transmit channel</span>
                )}

                {errMsg && (
                  <p className="ml-9 text-[10px] text-red-400">{errMsg}</p>
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
              onClick={() => void togglePttMode(!pttMode)}
              className={`relative h-6 w-11 rounded-full transition-colors ${pttMode ? "bg-brand/70" : "bg-slate-600"}`}
              aria-label="Toggle PTT mode"
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${pttMode ? "left-0.5" : "left-5"}`} />
            </button>
          </div>

          {/* PTT button or tx mute */}
          {pttMode ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <button
                type="button"
                onMouseDown={() => void startPtt()}
                onMouseUp={() => void stopPtt()}
                onTouchStart={(e) => { e.preventDefault(); void startPtt(); }}
                onTouchEnd={() => void stopPtt()}
                disabled={!anyConnected}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all duration-75 disabled:opacity-30 ${
                  ptt
                    ? "scale-95 bg-red-500 shadow-red-500/30 ring-4 ring-red-500/40"
                    : "bg-brand/80 hover:bg-brand"
                }`}
                aria-label="Push to talk"
              >
                {ptt ? <Mic className="h-8 w-8" /> : <MicOff className="h-8 w-8 opacity-60" />}
              </button>
              {transmitChannel && (
                <p className="text-[10px] text-slate-500">
                  → {getLabel(transmitChannel)}
                </p>
              )}
              <p className="text-xs text-slate-500">Hold · or hold Space</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-xs text-slate-300">Transmit</p>
                {transmitChannel && (
                  <p className="text-[10px] text-slate-500">→ {getLabel(transmitChannel)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void toggleTxMute()}
                disabled={!anyConnected}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-30 ${
                  txMuted
                    ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                    : "bg-green-500/20 text-green-300 ring-1 ring-green-500/30"
                }`}
              >
                {txMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {txMuted ? "Muted" : "Live"}
              </button>
            </div>
          )}

          {/* Master receive volume */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Master receive</p>
              <button
                type="button"
                onClick={() => setMasterMuted((m) => !m)}
                className="text-slate-400 hover:text-white"
                aria-label={masterMuted ? "Unmute" : "Mute"}
              >
                {masterMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={masterMuted ? 0 : masterVolume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMasterVolume(v);
                if (v > 0) setMasterMuted(false);
              }}
              className="w-full accent-brand"
            />
          </div>

          {/* Per-participant mixer */}
          {allRemoteParticipants.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <button
                type="button"
                onClick={() => setShowMixer((s) => !s)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Mixer ({allRemoteParticipants.length})
                  </p>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${showMixer ? "rotate-180" : ""}`} />
              </button>
              {showMixer && (
                <div className="mt-3 space-y-3">
                  {allRemoteParticipants.map((p) => {
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

          {/* Audio device pickers */}
          {devices.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Audio devices</p>

              <div>
                <p className="mb-1 text-[10px] text-slate-500">Mic / headset</p>
                <div className="relative">
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
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

              {devices.length > 1 && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">External input (audio interface)</p>
                    <button
                      type="button"
                      onClick={() => setUseExtInput((v) => !v)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${useExtInput ? "bg-brand/70" : "bg-slate-700"}`}
                      aria-label="Toggle external input"
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useExtInput ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>
                  {useExtInput && (
                    <div className="relative">
                      <select
                        value={selectedExt}
                        onChange={(e) => setSelectedExt(e.target.value)}
                        className="w-full appearance-none rounded-lg bg-white/10 px-3 py-2 pr-8 text-xs text-white outline-none focus:ring-1 focus:ring-brand/50"
                      >
                        {devices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId} className="bg-slate-900">
                            {d.label || `Input ${d.deviceId.slice(0, 6)}`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!livekitUrl && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <strong>LiveKit URL not configured.</strong> Radio will only work on the same device as the server.
          An admin must set a network-accessible LiveKit URL in{" "}
          <strong>Admin → Setup → LiveKit URL</strong>{" "}
          (e.g. <code className="font-mono">ws://192.168.1.x:7880</code> or <code className="font-mono">wss://livekit.yourdomain.com</code>)
          for phones and remote devices to connect.
        </p>
      )}
      {livekitUrl && (livekitUrl.includes("localhost") || livekitUrl.includes("127.0.0.1")) && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          LiveKit URL is set to <code className="font-mono">{livekitUrl}</code> — this only works on the same machine as the server.
          Update it to a network-accessible address for phones and remote users.
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
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-28">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Chunk (sec)
                </label>
                <input
                  type="number" min={4} max={30}
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

            {segments.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
                {segments.map((seg) => (
                  <div key={seg.id} className={`text-xs ${seg.error ? "text-red-400" : ""}`}>
                    <span className="mr-1.5 font-semibold text-brand/80">{seg.speaker}</span>
                    <span className="mr-2 text-slate-500">
                      {new Date(seg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
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
