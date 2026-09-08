import "server-only";

import { headers } from "next/headers";
import { auth, authConfigured } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * Who is asking, or null.
 *
 * Never throws. bran shares its session store with the storefront, which means
 * the reasons this can fail are mostly other people's — the database is down,
 * the secret was rotated on one side, the tables moved. None of those should
 * turn a dashboard into a stack trace; they should turn it into a signed-out
 * dashboard.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!authConfigured) return null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
    };
  } catch {
    return null;
  }
}

/** "Jaedan" out of "Jaedan Persaud", or the local part of an email. */
export function firstName(user: SessionUser | null): string | null {
  if (!user) return null;
  const fromName = user.name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = user.email.split("@")[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : null;
}
