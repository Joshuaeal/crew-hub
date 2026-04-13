import bcrypt from "bcryptjs";

/** @deprecated Legacy env-only subcontractor; prefer users in `.data/users.json`. */
export function getExpectedSubcontractorEmail() {
  return process.env.CREW_SUBCONTRACTOR_EMAIL?.trim().toLowerCase() ?? "";
}

/** @deprecated */
export function hasSubcontractorAuthConfigured() {
  return Boolean(
    process.env.CREW_SUBCONTRACTOR_EMAIL?.trim() &&
      process.env.CREW_SUBCONTRACTOR_PASSWORD_HASH?.trim()
  );
}

/** @deprecated */
export async function verifySubcontractorPassword(
  email: string,
  password: string
): Promise<boolean> {
  const expectedEmail = getExpectedSubcontractorEmail();
  const hash = process.env.CREW_SUBCONTRACTOR_PASSWORD_HASH?.trim();
  if (!expectedEmail || !hash) return false;
  if (email.trim().toLowerCase() !== expectedEmail) return false;
  return bcrypt.compare(password, hash);
}
