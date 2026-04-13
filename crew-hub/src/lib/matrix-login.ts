/**
 * Values for `identifier.user` in m.login.password — bare localpart or full MXID.
 * Crew Hub provisions `@localpart:${serverName}`; login must use the same localpart as the Crew username.
 */
export function normalizeMatrixLoginIdentifier(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.startsWith("@")) {
    const colon = t.indexOf(":");
    if (colon > 1) {
      return `@${t.slice(1, colon).toLowerCase()}:${t.slice(colon + 1)}`;
    }
    return t.toLowerCase();
  }
  return t.toLowerCase();
}

/** If the user typed a full MXID, the domain must match Synapse’s server_name. */
export function mxidDomainMismatchMessage(raw: string, expectedDomain: string): string | null {
  const t = raw.trim();
  if (!t.startsWith("@")) return null;
  const colon = t.indexOf(":");
  if (colon < 1) return null;
  const domain = t.slice(colon + 1).trim().toLowerCase();
  const exp = expectedDomain.trim().toLowerCase();
  if (!domain || !exp || domain === exp) return null;
  return `Your Matrix ID must end with :${exp} on this Synapse (not :${domain}). Try the username only, or @name:${exp}.`;
}
