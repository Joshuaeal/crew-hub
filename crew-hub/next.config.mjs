/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["matrix-js-sdk"],
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [{ source: "/onboard/orangehrm", destination: "/onboard/crew-hr", permanent: true }];
  },
  /** CORS on proxied Synapse responses (e.g. synapse-admin on :18088 → hub :38471). Applied without breaking rewrites. */
  async headers() {
    const cors = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      {
        key: "Access-Control-Allow-Methods",
        value: "GET, HEAD, POST, PUT, DELETE, OPTIONS",
      },
      {
        key: "Access-Control-Allow-Headers",
        value: "Content-Type, Authorization, X-Requested-With, If-None-Match",
      },
    ];
    return [
      { source: "/_matrix/:path*", headers: cors },
      { source: "/_synapse/:path*", headers: cors },
      { source: "/.well-known/matrix/:path*", headers: cors },
    ];
  },
  async rewrites() {
    const upstream = process.env.MATRIX_UPSTREAM_URL?.trim();
    const elementUpstream = process.env.ELEMENT_UPSTREAM_URL?.trim();
    const rules = [];
    if (upstream) {
      const base = upstream.replace(/\/$/, "");
      rules.push(
        { source: "/_matrix/:path*", destination: `${base}/_matrix/:path*` },
        { source: "/_synapse/:path*", destination: `${base}/_synapse/:path*` },
        { source: "/.well-known/matrix/:path*", destination: `${base}/.well-known/matrix/:path*` },
      );
    }
    if (elementUpstream) {
      const ebase = elementUpstream.replace(/\/$/, "");
      // Next.js app routes (e.g. /element/config.json) take priority over rewrites
      rules.push({ source: "/element/:path*", destination: `${ebase}/:path*` });
    }
    return rules;
  },
};

export default nextConfig;
