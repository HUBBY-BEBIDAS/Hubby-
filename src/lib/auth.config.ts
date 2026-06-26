import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import crypto from "crypto";
import speakeasy from "speakeasy";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { decrypt } from "@/lib/encryption";
import type { Role } from "@prisma/client";

// Roles que obrigam 2FA
const REQUIRES_2FA: Role[] = ["distributor_admin", "distributor_collaborator"];

function getPrivateKey() {
  const raw = process.env.NEXTAUTH_PRIVATE_KEY!;
  return raw.replace(/\\n/g, "\n");
}

function getPublicKey() {
  const raw = process.env.NEXTAUTH_PUBLIC_KEY!;
  return raw.replace(/\\n/g, "\n");
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ─── Email + Senha ───────────────────────────────────────────────────────
    CredentialsProvider({
      id: "credentials",
      name: "Email e senha",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
        totp: { label: "Código 2FA", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limiting por IP (x-forwarded-for em produção atrás de proxy)
        const ip =
          (req.headers?.["x-forwarded-for"] as string)?.split(",")[0].trim() ??
          "unknown";

        const rateLimit = await checkLoginRateLimit(ip);
        if (!rateLimit.allowed) {
          throw new Error(
            `RATE_LIMITED:${rateLimit.retryAfterSeconds}`
          );
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.password_hash) return null;

        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );
        if (!passwordValid) return null;

        // Verifica 2FA para roles que exigem
        const needs2FA = REQUIRES_2FA.includes(user.role);
        if (needs2FA && user.two_factor_enabled) {
          if (!credentials.totp) {
            throw new Error("2FA_REQUIRED");
          }

          const secret = decrypt(user.two_factor_secret!);
          const tokenValid = speakeasy.totp.verify({
            secret,
            encoding: "base32",
            token: credentials.totp.replace(/\s/g, ""),
            window: 1, // tolera 30s de desvio de relógio
          });

          if (!tokenValid) {
            throw new Error("INVALID_2FA");
          }
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { last_login_at: new Date() },
        });

        // twoFactorVerified: true se não precisa de 2FA ou se já validou acima
        const twoFactorVerified =
          !needs2FA || !user.two_factor_enabled || !!credentials.totp;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          twoFactorVerified,
        };
      },
    }),

    // ─── Google OAuth — só ativo se as credenciais estiverem configuradas ────
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  session: {
    strategy: "jwt",
    maxAge: 86400, // 24 horas
  },

  // ─── JWT com RS256 ──────────────────────────────────────────────────────────
  jwt: {
    async encode({ token, maxAge }) {
      const privateKey = await jose.importPKCS8(getPrivateKey(), "RS256");
      const jti = crypto.randomUUID();

      const payload: jose.JWTPayload = {
        ...(token as jose.JWTPayload),
        jti,
      };

      return await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: "RS256" })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + (maxAge ?? 86400))
        .sign(privateKey);
    },

    async decode({ token }) {
      if (!token) return null;
      try {
        const publicKey = await jose.importSPKI(getPublicKey(), "RS256");
        const { payload } = await jose.jwtVerify(token, publicKey, {
          algorithms: ["RS256"],
        });
        return payload as import("next-auth/jwt").JWT;
      } catch {
        return null;
      }
    },
  },

  // ─── Callbacks ──────────────────────────────────────────────────────────────
  callbacks: {
    async signIn({ account, profile }) {
      // Cria ou associa conta Google ao usuário existente
      if (account?.provider === "google" && profile?.email) {
        const existing = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        if (!existing) {
          await prisma.user.create({
            data: {
              email: profile.email,
              provider: "google",
              role: "client",
            },
          });
        } else if (existing.provider !== "google" && existing.provider !== "credentials") {
          // Provider incompatível
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Primeiro login — popula o JWT com dados do usuário
      if (user) {
        token.userId = user.id;
        token.role = (user as { role: Role }).role;
        token.twoFactorVerified = (user as { twoFactorVerified: boolean }).twoFactorVerified;
      }

      // Login via Google — busca o usuário no banco para pegar role
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.twoFactorVerified = true; // Google OAuth não exige 2FA
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { last_login_at: new Date() },
          });
        }
      }

      // Atualiza role após trigger de update
      if (trigger === "update" && token.userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId },
            select: { role: true },
          });
          if (dbUser) token.role = dbUser.role;
        } catch { /* ignora */ }
      }

      // Garante profileComplete sincronizado com o banco em toda invocação.
      // Roda sempre que não for true: primeiro login, tokens antigos (undefined),
      // e logo após completar o perfil (trigger=update).
      if (token.userId && token.role === "client" && !token.profileComplete) {
        try {
          const client = await prisma.client.findUnique({
            where: { user_id: token.userId },
            select: { id: true },
          });
          token.profileComplete = !!client;
        } catch {
          token.profileComplete = false;
        }
      } else if (token.userId && token.role !== "client" && token.profileComplete === undefined) {
        token.profileComplete = true;
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.twoFactorVerified = token.twoFactorVerified;
      session.user.profileComplete = token.profileComplete as boolean;
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
