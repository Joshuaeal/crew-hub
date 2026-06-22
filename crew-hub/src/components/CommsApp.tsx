"use client";

import {
  ClientEvent,
  createClient,
  MatrixError,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  RoomEvent,
  SyncState,
} from "matrix-js-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, LogOut, Send } from "lucide-react";
import { getBlueprintJoinHints } from "@/lib/matrix-channel-structure";
import {
  mxidDomainMismatchMessage,
  normalizeMatrixLoginIdentifier,
} from "@/lib/matrix-login";

type InitialAuth = {
  accessToken: string;
  userId: string;
  homeserverUrl: string;
  deviceId?: string;
};

type Props = {
  defaultHomeserver: string;
  /** Synapse server_name / MXID domain (e.g. localhost) — must match CREW_SYNAPSE_SERVER_NAME. */
  matrixDomain: string;
  /** True when Crew → Synapse user sync env is fully configured. */
  matrixSyncEnabled: boolean;
  /** MATRIX_UPSTREAM_URL is set — login should use this site’s URL, not :8008 directly. */
  matrixUsesHubProxy: boolean;
  /** Optional room id (`!xxx:server`) to select after sync when already joined — `CREW_MATRIX_DEFAULT_ROOM_ID`. */
  preferredRoomId?: string;
  /** When provided, skip the login form and connect immediately with these credentials. */
  initialAuth?: InitialAuth;
};

function matrixConnectErrorMessage(err: unknown, matrixDomain: string): string {
  if (
    err instanceof MatrixError &&
    (err.errcode === "M_FORBIDDEN" || err.httpStatus === 403)
  ) {
    return (
      "Synapse rejected the login — usually wrong password, or this Matrix user does not exist yet. " +
      `Use your Crew username (not email); your MXID is @that-name:${matrixDomain}. ` +
      "Password must be the one on Synapse (same as Crew if Admin → Users created you with Matrix sync). " +
      "Synapse being reachable in a browser does not create accounts — enable sync and create users in Crew, or register in Element against Synapse."
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("fetch") ||
    lower.includes("networkerror") ||
    lower === "failed to fetch"
  ) {
    return (
      "Could not reach the homeserver (often CORS or mixed HTTP/HTTPS). " +
      "Set MATRIX_UPSTREAM_URL to your Synapse base URL on the server and restart the hub so /_matrix is proxied same-origin, " +
      "or configure Synapse to allow this site’s origin in CORS."
    );
  }
  return msg || "Login failed (check homeserver URL and credentials).";
}

export function CommsApp({
  defaultHomeserver,
  matrixDomain,
  matrixSyncEnabled,
  matrixUsesHubProxy,
  preferredRoomId,
  initialAuth,
}: Props) {
  const [homeserver, setHomeserver] = useState(
    defaultHomeserver.replace(/\/$/, ""),
  );
  const [localpart, setLocalpart] = useState("");
  const [password, setPassword] = useState("");
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [syncState, setSyncState] = useState<string>("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<MatrixEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState<string | null>(null);
  const [customJoin, setCustomJoin] = useState("");

  const joinHints = useMemo(
    () => getBlueprintJoinHints(matrixDomain),
    [matrixDomain],
  );

  const preferred = preferredRoomId?.trim() ?? "";
  const defaultRoomAppliedRef = useRef(false);

  const refreshJoinedRooms = useCallback((c: MatrixClient) => {
    setRooms(c.getRooms().filter((r) => r.getMyMembership() === "join"));
  }, []);

  // Auto-connect when the server provides credentials (skips login form)
  useEffect(() => {
    if (!initialAuth) return;
    const { accessToken, userId, homeserverUrl, deviceId } = initialAuth;
    const c = createClient({
      baseUrl: homeserverUrl.replace(/\/$/, ""),
      accessToken,
      userId,
      deviceId,
    });
    c.on(ClientEvent.Sync, (state) => {
      setSyncState(state);
      refreshJoinedRooms(c);
    });
    c.on(RoomEvent.MyMembership, () => {
      refreshJoinedRooms(c);
    });
    c.startClient({ initialSyncLimit: 30 });
    defaultRoomAppliedRef.current = false;
    setClient(c);
    setHomeserver(homeserverUrl.replace(/\/$/, ""));
    return () => { c.stopClient(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRoom = useMemo(
    () =>
      activeRoomId
        ? (rooms.find((r) => r.roomId === activeRoomId) ?? null)
        : null,
    [rooms, activeRoomId],
  );

  const refreshTimeline = useCallback((roomId: string, c: MatrixClient) => {
    const room = c.getRoom(roomId);
    if (!room) return;
    const live = room.getLiveTimeline();
    setTimeline(
      live.getEvents().filter((e) => e.getType() === "m.room.message"),
    );
  }, []);

  useEffect(() => {
    if (!client || !activeRoomId) {
      setTimeline([]);
      return;
    }
    refreshTimeline(activeRoomId, client);
    const onTimeline = () => refreshTimeline(activeRoomId, client);
    client.on(RoomEvent.Timeline, onTimeline);
    return () => {
      client.removeListener(RoomEvent.Timeline, onTimeline);
    };
  }, [client, activeRoomId, refreshTimeline]);

  useEffect(() => {
    if (
      !preferred ||
      !client ||
      rooms.length === 0 ||
      defaultRoomAppliedRef.current
    )
      return;
    const hit = rooms.some((r) => r.roomId === preferred);
    if (hit) {
      setActiveRoomId(preferred);
      defaultRoomAppliedRef.current = true;
    }
  }, [client, rooms, preferred]);

  // If sync drops the active room before its membership event arrives, rescue it
  useEffect(() => {
    if (!activeRoomId || !client) return;
    if (rooms.some((r) => r.roomId === activeRoomId)) return;
    const room = client.getRoom(activeRoomId);
    if (room) setRooms((prev) => (prev.some((r) => r.roomId === room.roomId) ? prev : [...prev, room]));
  }, [rooms, activeRoomId, client]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const domainErr = mxidDomainMismatchMessage(localpart, matrixDomain);
    if (domainErr) {
      setError(domainErr);
      return;
    }
    setBusy(true);
    try {
      const c = createClient({ baseUrl: homeserver });
      const user = normalizeMatrixLoginIdentifier(localpart);
      await c.login("m.login.password", {
        identifier: { type: "m.id.user", user },
        password,
        initial_device_display_name: "Crew Hub",
      });
      c.on(ClientEvent.Sync, (state) => {
        setSyncState(state);
        refreshJoinedRooms(c);
      });
      c.on(RoomEvent.MyMembership, () => {
        refreshJoinedRooms(c);
      });
      c.startClient({ initialSyncLimit: 30 });
      defaultRoomAppliedRef.current = false;
      setClient(c);
      setPassword("");
    } catch (err) {
      setError(matrixConnectErrorMessage(err, matrixDomain));
    } finally {
      setBusy(false);
    }
  }

  const joinChannel = useCallback(
    async (fullAlias: string) => {
      if (!client) return;
      setJoinBusy(fullAlias);
      setError(null);
      try {
        const room = await client.joinRoom(fullAlias);
        // Fetch room state so name/members/timeline are populated before we display it
        try { await client.roomState(room.roomId); } catch { /* best-effort */ }
        // Add immediately — sync may lag behind the join
        setRooms((prev) =>
          prev.some((r) => r.roomId === room.roomId) ? prev : [...prev, room],
        );
        setActiveRoomId(room.roomId);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Join failed — the room may not exist on this server yet.";
        setError(
          `${msg} Create rooms with \`npm run matrix:provision-rooms\` (see server docs), or join in Element first.`,
        );
      } finally {
        setJoinBusy(null);
      }
    },
    [client, refreshJoinedRooms],
  );

  async function joinCustomAlias(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !customJoin.trim()) return;
    let alias = customJoin.trim();
    if (!alias.startsWith("#")) {
      alias = `#${alias}:${matrixDomain}`;
    }
    await joinChannel(alias);
    setCustomJoin("");
  }

  async function handleLogout() {
    if (client) {
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
      client.stopClient();
    }
    setClient(null);
    setRooms([]);
    setActiveRoomId(null);
    setTimeline([]);
    setSyncState("");
    defaultRoomAppliedRef.current = false;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !activeRoomId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await client.sendTextMessage(activeRoomId, draft.trim());
      setDraft("");
      refreshTimeline(activeRoomId, client);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!client) {
    return (
      <div className="mx-auto flex min-h-0 flex-1 flex-col justify-center px-4 py-8 sm:max-w-md">
        <h1 className="text-xl font-semibold text-white">Matrix channels</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with the same{" "}
          <strong className="text-slate-300">username</strong> as Crew Hub (not
          your email). Your Matrix ID looks like{" "}
          <code className="rounded bg-white/10 px-1 text-xs">{`@username:${matrixDomain}`}</code>
          {matrixSyncEnabled
            ? " — new users from Admin → Users are created on Synapse when sync is enabled."
            : " — without sync, create Matrix accounts in Synapse or Element; use the same username as Crew if you add them manually."}
        </p>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
          <div>
            <label className="text-sm text-slate-300">
              Homeserver base URL
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              required
            />
            {matrixUsesHubProxy ? (
              <p className="mt-1.5 text-xs leading-snug text-slate-500">
                Use{" "}
                <strong className="text-slate-400">this Crew Hub URL</strong>{" "}
                (same host/port as in your browser bar, e.g.{" "}
                <code className="rounded bg-white/10 px-1">
                  http://127.0.0.1:38471
                </code>
                ) so requests go through the hub&apos;s{" "}
                <code className="rounded bg-white/10 px-1">/_matrix</code>{" "}
                proxy. Do <strong className="text-slate-400">not</strong> put
                Synapse&apos;s{" "}
                <code className="rounded bg-white/10 px-1">:8008</code> here
                unless you have fixed CORS — the static page at{" "}
                <code className="rounded bg-white/10 px-1">
                  /_matrix/static/
                </code>{" "}
                only proves Synapse is up; it does not mean your user exists.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Point this at your Synapse Client API base (often{" "}
                <code className="rounded bg-white/10 px-1">
                  http://127.0.0.1:8008
                </code>
                ). Set{" "}
                <code className="rounded bg-white/10 px-1">
                  MATRIX_UPSTREAM_URL
                </code>{" "}
                on the hub to proxy through Crew and avoid CORS issues.
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-slate-300">
              Crew username or full Matrix ID
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={localpart}
              onChange={(e) => setLocalpart(e.target.value)}
              placeholder={`e.g. alex or @alex:${matrixDomain}`}
              autoComplete="username"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Not your email address — the short Crew login name, matching
              Synapse’s <span className="text-slate-400">server_name</span> (
              {matrixDomain}).
            </p>
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
            disabled={busy}
            className="w-full rounded-lg bg-brand/90 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Sign in to Matrix"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white sm:text-base">
            Matrix channels
          </h1>
          <p className="truncate text-xs text-slate-500">
            {syncState === SyncState.Syncing
              ? "Syncing…"
              : syncState || "Ready"}{" "}
            · {homeserver}
          </p>
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
      {error && (
        <p className="border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-100">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-black/20 md:w-72 md:border-b-0 md:border-r">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Rooms
          </p>
          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="space-y-3 px-3 pb-3">
                <p className="text-xs leading-snug text-slate-500">
                  You haven&apos;t{" "}
                  <strong className="text-slate-400">joined</strong> any
                  channels yet — Matrix only lists rooms you&apos;re a member
                  of. Use the buttons below (after rooms exist on Synapse), or
                  join in Element.
                </p>
                <details className="rounded-lg border border-white/10 bg-black/30 text-xs open:border-brand/30">
                  <summary className="cursor-pointer px-2 py-1.5 font-medium text-slate-300">
                    Join from Raconteur blueprint
                  </summary>
                  <div className="space-y-1 overflow-y-auto border-t border-white/10 p-2">
                    {joinHints.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        disabled={joinBusy !== null}
                        onClick={() => void joinChannel(h.fullAlias)}
                        className="flex w-full items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-50"
                      >
                        {joinBusy === h.fullAlias ? (
                          <Loader2
                            className="h-3 w-3 shrink-0 animate-spin text-brand/90"
                            aria-hidden
                          />
                        ) : null}
                        <span className="min-w-0 truncate">{h.label}</span>
                      </button>
                    ))}
                  </div>
                </details>
                <form
                  onSubmit={(e) => void joinCustomAlias(e)}
                  className="space-y-1"
                >
                  <label className="text-[10px] text-slate-500">
                    Join by alias
                  </label>
                  <div className="flex gap-1">
                    <input
                      className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-white"
                      placeholder={`general or #general:${matrixDomain}`}
                      value={customJoin}
                      onChange={(e) => setCustomJoin(e.target.value)}
                      disabled={joinBusy !== null}
                    />
                    <button
                      type="submit"
                      disabled={joinBusy !== null || !customJoin.trim()}
                      className="shrink-0 rounded bg-brand/80 px-2 py-1.5 text-[11px] font-medium text-slate-950 disabled:opacity-50"
                    >
                      Join
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              rooms.map((r) => (
                <button
                  key={r.roomId}
                  type="button"
                  onClick={() => setActiveRoomId(r.roomId)}
                  className={`block w-full truncate px-3 py-2 text-left text-sm ${
                    activeRoomId === r.roomId
                      ? "bg-brand/15 text-brand/95"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {r.name || r.roomId}
                </button>
              ))
            )}
          </div>
          {rooms.length > 0 && (
            <div className="border-t border-white/10 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Join another
              </p>
              <form
                onSubmit={(e) => void joinCustomAlias(e)}
                className="flex gap-1"
              >
                <input
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-white"
                  placeholder={`#channel:${matrixDomain}`}
                  value={customJoin}
                  onChange={(e) => setCustomJoin(e.target.value)}
                  disabled={joinBusy !== null}
                />
                <button
                  type="submit"
                  disabled={joinBusy !== null || !customJoin.trim()}
                  className="shrink-0 rounded bg-white/10 px-2 py-1.5 text-[11px] text-slate-200 hover:bg-white/15 disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            </div>
          )}
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!activeRoom ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
              {rooms.length === 0 ? (
                <>
                  <p>
                    Join a channel in the{" "}
                    <strong className="text-slate-400">sidebar</strong>{" "}
                    (blueprint list or alias). If joins fail, rooms may not
                    exist yet — run{" "}
                    <code className="rounded bg-white/10 px-1 text-xs">
                      npm run matrix:provision-rooms
                    </code>{" "}
                    on the server (needs a Matrix user access token).
                  </p>
                  <p className="text-xs text-slate-600">
                    Expand{" "}
                    <strong className="text-slate-500">
                      Raconteur Matrix channel blueprint
                    </strong>{" "}
                    above for the full layout.
                  </p>
                </>
              ) : (
                <p>
                  Select a room from the list, or join another using the field
                  under the list.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 px-3 py-2">
                <h2 className="truncate font-medium text-white">
                  {activeRoom.name?.startsWith("!")
                    ? activeRoom.roomId
                    : activeRoom.name || activeRoom.roomId}
                </h2>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {timeline.map((ev) => {
                  const content = ev.getContent() as { body?: string };
                  const body =
                    typeof content?.body === "string" ? content.body : "";
                  const sender = ev.getSender() || "?";
                  return (
                    <div
                      key={`${ev.getId() ?? "e"}-${ev.getTs()}`}
                      className="rounded-lg bg-white/5 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-brand/80">
                        {sender}
                      </span>
                      <p className="mt-1 whitespace-pre-wrap text-slate-200">
                        {body}
                      </p>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={handleSend}
                className="flex gap-2 border-t border-white/10 p-3"
              >
                <input
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  placeholder="Message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand/90 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
