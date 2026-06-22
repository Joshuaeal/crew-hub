/**
 * AFFiNE auth bridge — server-side only.
 *
 * STRATEGY (plaintext password mirror):
 *   When a Crew Hub user is created or logs in, their AFFiNE account is provisioned (or
 *   updated) with the same plaintext password they use in Crew Hub. This means users can
 *   log in to AFFiNE directly with their Crew Hub email and password if the iframe prompts
 *   them. AFFiNE remembers the session via its own cookie, so login is a one-time step per
 *   browser.
 *
 * ENV VARS REQUIRED (for provisioning):
 *   AFFINE_ADMIN_EMAIL     — email of the AFFiNE server admin account
 *   AFFINE_ADMIN_PASSWORD  — password of the AFFiNE server admin account
 */

const GQL_PATH = "/graphql";

async function gql(
  affineUrl: string,
  query: string,
  variables: Record<string, unknown>,
  authToken?: string
): Promise<Record<string, unknown>> {
  const url = affineUrl.replace(/\/$/, "") + GQL_PATH;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AFFiNE GraphQL HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`AFFiNE GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data ?? {};
}

async function signIn(affineUrl: string, email: string, password: string): Promise<string> {
  const data = await gql(affineUrl, `
    mutation SignIn($email: String!, $password: String!) {
      signIn(email: $email, password: $password) {
        token { token }
      }
    }
  `, { email, password });
  const token = (data?.signIn as { token?: { token?: string } })?.token?.token;
  if (!token) throw new Error("AFFiNE signIn returned no token");
  return token;
}

async function adminToken(affineUrl: string): Promise<string> {
  const email = process.env.AFFINE_ADMIN_EMAIL;
  const password = process.env.AFFINE_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("AFFINE_ADMIN_EMAIL / AFFINE_ADMIN_PASSWORD not set");
  return signIn(affineUrl, email, password);
}

async function createAffineUser(
  affineUrl: string,
  adminJwt: string,
  name: string,
  email: string,
  password: string
): Promise<void> {
  await gql(
    affineUrl,
    `mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) { id }
    }`,
    { input: { name, email, password } },
    adminJwt
  );
}

/**
 * Provision (or update) an AFFiNE account using the user's actual Crew Hub password.
 * Call this fire-and-forget after a successful login or user creation.
 * Silently swallows errors — Affine availability is non-critical.
 */
export async function provisionAffineUser(
  affineUrl: string,
  email: string,
  displayName: string,
  plainPassword: string
): Promise<void> {
  if (!process.env.AFFINE_ADMIN_EMAIL || !process.env.AFFINE_ADMIN_PASSWORD) return;

  // Try signing in first — if it works the account already exists with this password
  try {
    await signIn(affineUrl, email, plainPassword);
    return;
  } catch {
    // Account doesn't exist yet (or password mismatch from old HMAC approach) — provision it
  }

  try {
    const admin = await adminToken(affineUrl);
    await createAffineUser(affineUrl, admin, displayName || email.split("@")[0], email, plainPassword);
  } catch {
    // Silently ignore — AFFiNE may be unavailable or account already exists
  }
}
