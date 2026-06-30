/**
 * AFFiNE auth bridge — server-side only.
 *
 * STRATEGY (plaintext password mirror):
 *   When a Crew Hub user logs in or is created, their AFFiNE account is provisioned
 *   with the same plaintext password and added to all AFFiNE workspaces automatically.
 *   Users can then sign in to AFFiNE directly with their Crew Hub email and password.
 *
 * ENV VARS REQUIRED (for provisioning):
 *   AFFINE_ADMIN_EMAIL     — email of the AFFiNE server admin account
 *   AFFINE_ADMIN_PASSWORD  — password for that admin account
 */

const GQL_PATH = "/graphql";

interface AffineSession {
  session: string;
  csrf: string;
}

/** Sign in via REST and return session cookies. */
async function restSignIn(affineUrl: string, email: string, password: string): Promise<AffineSession> {
  const res = await fetch(`${affineUrl.replace(/\/$/, "")}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const cookies = (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie?.() ?? [];
  const session = cookies.find(c => c.startsWith("affine_session="))?.split(";")[0]?.split("=")[1];
  const csrf    = cookies.find(c => c.startsWith("affine_csrf_token="))?.split(";")[0]?.split("=")[1];
  if (!session) {
    const body = await res.json() as { message?: string };
    throw new Error(body.message ?? `AFFiNE sign-in failed (${res.status})`);
  }
  return { session, csrf: csrf ?? "" };
}

async function gql(
  affineUrl: string,
  query: string,
  variables: Record<string, unknown>,
  auth?: AffineSession
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    headers["Cookie"] = `affine_session=${auth.session}; affine_csrf_token=${auth.csrf}`;
    headers["x-affine-csrf-token"] = auth.csrf;
  }
  const res = await fetch(`${affineUrl.replace(/\/$/, "")}${GQL_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AFFiNE GraphQL HTTP ${res.status}`);
  const json = await res.json() as { data?: Record<string, unknown>; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data ?? {};
}

async function adminSession(affineUrl: string): Promise<AffineSession> {
  const email    = process.env.AFFINE_ADMIN_EMAIL;
  const password = process.env.AFFINE_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("AFFINE_ADMIN_EMAIL / AFFINE_ADMIN_PASSWORD not set");
  return restSignIn(affineUrl, email, password);
}

async function getWorkspaceIds(affineUrl: string, auth: AffineSession): Promise<string[]> {
  const data = await gql(affineUrl, `{ workspaces { id } }`, {}, auth);
  return ((data.workspaces as { id: string }[]) ?? []).map(w => w.id);
}

async function inviteToWorkspaces(affineUrl: string, auth: AffineSession, email: string): Promise<void> {
  const workspaceIds = await getWorkspaceIds(affineUrl, auth);
  for (const workspaceId of workspaceIds) {
    try {
      await gql(
        affineUrl,
        `mutation InviteMembers($workspaceId: String!, $emails: [String!]!) {
          inviteMembers(workspaceId: $workspaceId, emails: $emails)
        }`,
        { workspaceId, emails: [email] },
        auth
      );
    } catch {
      // User may already be a member — not fatal
    }
  }
}

/**
 * Provision (or update) an AFFiNE account using the user's actual Crew Hub password,
 * and ensure they are a member of all workspaces.
 * Call fire-and-forget after a successful login or user creation.
 * Silently swallows errors — AFFiNE availability is non-critical.
 */
export async function provisionAffineUser(
  affineUrl: string,
  email: string,
  displayName: string,
  plainPassword: string
): Promise<void> {
  if (!process.env.AFFINE_ADMIN_EMAIL || !process.env.AFFINE_ADMIN_PASSWORD) return;

  const admin = await adminSession(affineUrl);

  // Try signing in as the user — if it works, account exists with correct password
  let userExists = false;
  try {
    await restSignIn(affineUrl, email, plainPassword);
    userExists = true;
  } catch {
    // Account doesn't exist yet or has a different password
  }

  if (!userExists) {
    // Create the account via GraphQL (admin)
    try {
      await gql(
        affineUrl,
        `mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }`,
        { input: { name: displayName || email.split("@")[0], email, password: plainPassword } },
        admin
      );
    } catch {
      // May already exist with a different password — fall through to workspace invite
    }
  }

  // Add to all workspaces (idempotent — safe to call every time)
  await inviteToWorkspaces(affineUrl, admin, email);
}
