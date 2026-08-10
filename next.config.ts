import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  // Next.js exige unsafe-inline e unsafe-eval em dev; em prod apenas unsafe-inline para estilos injetados
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://api.stripe.com https://viacep.com.br https://brasilapi.com.br https://nominatim.openstreetmap.org https://maps.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options",        value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  {
    key:   "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
  {
    key:   "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin",      value: "*" },
          { key: "Access-Control-Allow-Methods",     value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          {
            key:   "Access-Control-Allow-Headers",
            value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/login", destination: "/auth/login", permanent: true },
      { source: "/cadastro", destination: "/auth/register", permanent: true },
      { source: "/register", destination: "/auth/register", permanent: true },
      { source: "/cadastrar", destination: "/auth/register", permanent: true },
      { source: "/dashboard", destination: "/painel", permanent: true },
      { source: "/regioes", destination: "/painel/regioes", permanent: true },
      { source: "/produtos", destination: "/painel/produtos", permanent: true },
      { source: "/pedidos", destination: "/painel/pedidos", permanent: true },
    ];
  },
};

export default nextConfig;
