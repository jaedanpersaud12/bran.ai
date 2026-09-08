import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Better Auth's own endpoints. bran mounts them so a session can be read and
 * refreshed here, against the storefront's tables — see `src/lib/auth.ts`.
 */
export const { GET, POST } = toNextJsHandler(auth);
