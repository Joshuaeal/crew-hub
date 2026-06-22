import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const hsUrl =
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_CREW_PUBLIC_URL?.trim() ||
    "http://localhost:8008";
  const serverName =
    process.env.CREW_SYNAPSE_SERVER_NAME?.trim() ||
    process.env.SYNAPSE_SERVER_NAME?.trim() ||
    "localhost";

  const config = {
    default_server_config: {
      "m.homeserver": {
        base_url: hsUrl,
        server_name: serverName,
      },
    },
    disable_custom_urls: true,
    disable_guests: true,
    brand: "Crew Hub",
    default_theme: "dark",
  };

  return NextResponse.json(config, {
    headers: { "Content-Type": "application/json" },
  });
}
