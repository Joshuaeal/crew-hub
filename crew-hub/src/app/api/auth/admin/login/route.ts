import { loginWithCredentials } from "@/lib/auth-login";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const identifier = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  return loginWithCredentials(identifier, password, request);
}
