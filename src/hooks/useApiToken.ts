"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Retorna o JWT de sessão para uso nas chamadas de API com Bearer token.
 * Atualiza automaticamente quando a sessão muda.
 */
export function useApiToken(): string | null {
  const { status } = useSession();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setToken(null);
      return;
    }

    fetch("/api/auth/token")
      .then((r) => r.json())
      .then((d: { token: string | null }) => setToken(d.token))
      .catch(() => setToken(null));
  }, [status]);

  return token;
}

/**
 * Helper: fetch autenticado com Bearer token.
 * Lança erro se o token não estiver disponível.
 */
export async function apiFetch(
  url: string,
  options: RequestInit & { token: string }
): Promise<Response> {
  const { token, headers, ...rest } = options;
  return fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(headers as Record<string, string>),
    },
  });
}
