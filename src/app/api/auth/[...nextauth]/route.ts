import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth.config";

// Força renderização dinâmica — impede o Next.js 16 de tentar pré-gerar
// caminhos estáticos para esta rota, o que causava crash do worker e
// fazia o endpoint retornar HTML em vez de JSON.
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
