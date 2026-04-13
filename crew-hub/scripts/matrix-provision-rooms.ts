/**
 * Create Matrix rooms from MATRIX_CHANNEL_BLUEPRINT (aliases + topics).
 *
 * Auth (one of):
 *   • CREW_MATRIX_SEED_ACCESS_TOKEN — from Element → Settings → Help & About → Access token
 *   • CREW_MATRIX_SEED_USER + CREW_MATRIX_SEED_PASSWORD — Matrix localpart + password (user must exist), or
 *     with CREW_SYNAPSE_ADMIN_ACCESS_TOKEN — user is created/updated via Synapse Admin API first, then login
 *
 * Homeserver base (Client API):
 *   • MATRIX_HOMESERVER_URL or MATRIX_UPSTREAM_URL
 *   • From the host (Synapse port mapped): http://127.0.0.1:8008
 *   • Inside Docker Compose: http://synapse:8008 (run via `docker compose run` or exec, not from Mac with synapse:8008 unless in network)
 *   • Through Crew proxy: http://127.0.0.1:38471 (same origin as hub; use Matrix user that exists on Synapse)
 *
 * Usage (from crew-hub/):
 *   Loads `../.env` (repo root) then `crew-hub/.env` so the same vars as Compose work.
 *   MATRIX_UPSTREAM_URL=http://127.0.0.1:8008 CREW_MATRIX_SEED_ACCESS_TOKEN=syt_... npx tsx scripts/matrix-provision-rooms.ts
 *   MATRIX_UPSTREAM_URL=http://127.0.0.1:8008 CREW_MATRIX_SEED_USER=alice CREW_MATRIX_SEED_PASSWORD=... npx tsx scripts/matrix-provision-rooms.ts
 */

import { config } from "dotenv";
import path from "path";
import {
  MATRIX_CHANNEL_BLUEPRINT,
  MATRIX_VOICE_NOTE,
} from "../src/lib/matrix-channel-structure";
import { matrixServerName, upsertMatrixUser } from "../src/lib/matrix-provision";

config({ path: path.resolve(process.cwd(), "../.env"), quiet: true });
config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

async function createRoom(
  base: string,
  token: string,
  opts: {
    name: string;
    alias: string;
    topic: string;
    inviteOnly: boolean;
  }
): Promise<void> {
  const url = `${base.replace(/\/$/, "")}/_matrix/client/v3/createRoom`;
  const body: Record<string, unknown> = {
    name: opts.name.slice(0, 255),
    topic: opts.topic.slice(0, 500),
    room_alias_name: opts.alias,
    preset: opts.inviteOnly ? "private_chat" : "public_chat",
  };
  if (opts.inviteOnly) {
    body.visibility = "private";
    body.initial_state = [
      {
        type: "m.room.join_rules",
        state_key: "",
        content: { join_rule: "invite" },
      },
    ];
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const j = (await res.json().catch(() => ({}))) as { errcode?: string; error?: string; room_id?: string };

  if (res.ok) {
    console.log(`  ✓ #${opts.alias} → ${j.room_id ?? "ok"}`);
    return;
  }

  const msg = typeof j.error === "string" ? j.error : JSON.stringify(j);
  if (res.status === 400 || res.status === 409) {
    console.log(`  (skip) #${opts.alias}: ${msg}`);
    return;
  }

  throw new Error(`createRoom ${opts.alias}: ${res.status} ${msg}`);
}

function textDisplayName(t: { title: string; alias: string }): string {
  return t.title.replace(/^#/, "").replace(/\[project-name\]/gi, "project").slice(0, 255);
}

async function resolveAccessToken(base: string): Promise<string> {
  const existing = process.env.CREW_MATRIX_SEED_ACCESS_TOKEN?.trim();
  if (existing) return existing;

  const localpart = process.env.CREW_MATRIX_SEED_USER?.trim();
  const password = process.env.CREW_MATRIX_SEED_PASSWORD?.trim();

  if (
    localpart &&
    password &&
    process.env.CREW_SYNAPSE_ADMIN_ACCESS_TOKEN?.trim() &&
    process.env.MATRIX_UPSTREAM_URL?.trim()
  ) {
    try {
      await upsertMatrixUser({
        localpart,
        password,
        displayName: "Crew blueprint rooms",
      });
      const dom = matrixServerName() || "localhost";
      console.log(`Synapse user @${localpart}:${dom} ensured via admin API.\n`);
    } catch (e) {
      console.error("Admin API: could not create/update Matrix user:", e);
      process.exit(1);
    }
  }

  if (!localpart || !password) {
    console.error(
      "Set one of:\n" +
        "  CREW_MATRIX_SEED_ACCESS_TOKEN — Element → Settings → Help & About → Access token\n" +
        "  CREW_MATRIX_SEED_USER + CREW_MATRIX_SEED_PASSWORD — Matrix localpart + password\n" +
        "Optional with user/password: CREW_SYNAPSE_ADMIN_ACCESS_TOKEN — server-admin token so the user can be created if missing (same as Hub → Matrix sync)."
    );
    process.exit(1);
  }

  const url = `${base.replace(/\/$/, "")}/_matrix/client/v3/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: localpart },
      password,
      initial_device_display_name: "Crew matrix-provision-rooms",
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    errcode?: string;
    error?: string;
  };
  if (!res.ok || !j.access_token) {
    console.error("Matrix login failed:", j.error || j.errcode || res.status);
    process.exit(1);
  }
  console.log(`Logged in as ${localpart} (password auth) and obtained access token.\n`);
  return j.access_token;
}

async function main() {
  const base =
    process.env.MATRIX_HOMESERVER_URL?.trim() ||
    process.env.MATRIX_UPSTREAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim();

  if (!base) {
    console.error(
      "Set MATRIX_HOMESERVER_URL, MATRIX_UPSTREAM_URL, or NEXT_PUBLIC_MATRIX_HOMESERVER_URL (Synapse Client API base), e.g. http://127.0.0.1:8008"
    );
    process.exit(1);
  }

  const token = await resolveAccessToken(base);

  console.log(`Homeserver: ${base}`);
  console.log("Provisioning rooms from blueprint…\n");

  for (const cat of MATRIX_CHANNEL_BLUEPRINT) {
    console.log(`\n## ${cat.title}`);
    const inviteOnly = Boolean(cat.restricted);

    for (const t of cat.text) {
      if (t.template) {
        console.log(
          `  (manual) #${t.alias} — create per job in Element; use threads for shoot days, edits, client notes`
        );
        continue;
      }
      await createRoom(base, token, {
        name: textDisplayName(t),
        alias: t.alias,
        topic: `${cat.title}\n${t.description}`,
        inviteOnly,
      });
    }

    for (const v of cat.voice) {
      await createRoom(base, token, {
        name: `🔊 ${v.name}`,
        alias: v.alias,
        topic: `[Voice] ${v.description}\n${v.useCases.join(" · ")}\n\n${MATRIX_VOICE_NOTE}`,
        inviteOnly,
      });
    }
  }

  console.log("\nDone. Join rooms in Element or Crew Channels after inviting this user.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
