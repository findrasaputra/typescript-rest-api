import { Elysia } from "elysia";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Derives `userId` and `email` from a Bearer JWT on every request.
 * Uses HS256 with the JWT_SECRET environment variable.
 */
export const verifyToken = (app: Elysia) =>
  // @ts-ignore — Elysia derive typing limitation with generics
  app.derive(({ headers, set }: { headers: Record<string, string | undefined>; set: { status: number } }) => {
    const auth = headers["authorization"];

    if (!auth?.startsWith("Bearer ")) {
      set.status = 401;
      throw new Error("Unauthorized");
    }

    const token = auth.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      return { userId: decoded.userId, email: decoded.email };
    } catch {
      set.status = 401;
      throw new Error("Unauthorized");
    }
  });

/**
 * Sign a JWT for the given payload. Expires in 7 days by default.
 */
export function signToken(payload: JwtPayload, expiresIn = "7d"): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as jwt.SignOptions);
}
