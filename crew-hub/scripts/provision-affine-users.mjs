/**
 * Provision existing Crew Hub users into AFFiNE.
 *
 * NOTE: AFFiNE accounts now mirror the user's actual Crew Hub password, which is set
 * automatically on each login. This script is mainly useful for pre-creating accounts
 * so users appear in the AFFiNE admin panel before their first login.
 *
 * Since plaintext passwords are not recoverable from Crew Hub's bcrypt hashes, this script
 * creates accounts with a random temporary password. Users' real passwords will be synced
 * the next time they log in to Crew Hub.
 *
 * Run from crew-hub directory:
 *   node scripts/provision-affine-users.mjs
 */

import crypto from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";

const AFFINE_URL     = process.env.AFFINE_EXTERNAL_URL   || "https://boards.raconteur.melbourne";
const ADMIN_EMAIL    = process.env.AFFINE_ADMIN_EMAIL    || "josh@alegrevisual.com";
const ADMIN_PASSWORD = process.env.AFFINE_ADMIN_PASSWORD || "yVnNT8dMjrUkfRgA7EtrC5Kc";

async function gql(query, variables, authToken) {
  const url = AFFINE_URL.replace(/\/$/, "") + "/graphql";
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function signIn(email, password) {
  const data = await gql(
    `mutation SignIn($email: String!, $password: String!) {
      signIn(email: $email, password: $password) { token { token } }
    }`,
    { email, password }
  );
  const token = data?.signIn?.token?.token;
  if (!token) throw new Error("No token returned");
  return token;
}

async function createUser(adminToken, name, email, password) {
  return gql(
    `mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) { id email }
    }`,
    { input: { name, email, password } },
    adminToken
  );
}

async function main() {
  const usersPath = join(process.cwd(), ".data", "users.json");
  const users = JSON.parse(await readFile(usersPath, "utf-8"));

  console.log(`Found ${users.length} Crew Hub users`);
  console.log(`AFFiNE URL: ${AFFINE_URL}`);
  console.log("NOTE: Accounts are pre-created with a temp password. Real passwords sync on first Crew Hub login.\n");

  console.log(`Signing in as admin (${ADMIN_EMAIL})...`);
  const adminTok = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Admin signed in.\n");

  for (const user of users) {
    const email = user.email;
    const name = user.name || user.displayName || email.split("@")[0];
    // Temp password — will be replaced with user's real password on their next Crew Hub login
    const tempPassword = crypto.randomBytes(16).toString("hex");

    process.stdout.write(`${email} — `);

    try {
      await createUser(adminTok, name, email, tempPassword);
      console.log("created (temp password) ✓");
    } catch (err) {
      const msg = err.message;
      if (msg.includes("already") || msg.includes("exist") || msg.includes("duplicate")) {
        console.log("already exists ✓");
      } else {
        console.log(`FAILED ✗ — ${msg}`);
      }
    }
  }

  console.log("\nDone. Users will get their real passwords synced on next login.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
