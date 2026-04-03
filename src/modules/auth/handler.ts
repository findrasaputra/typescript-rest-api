import { prisma } from "~libs/prisma";
import { signToken } from "~middlewares/auth";
import { successResponse, errorResponse } from "~utils/response";

export async function register(body: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return { status: 409, body: errorResponse("Email already in use") };
  }

  const hashed = await Bun.password.hash(body.password);
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, password: hashed },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { status: 201, body: successResponse("Registration successful", { user, token }) };
}

export async function login(body: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    return { status: 401, body: errorResponse("Invalid credentials") };
  }

  const valid = await Bun.password.verify(body.password, user.password);
  if (!valid) {
    return { status: 401, body: errorResponse("Invalid credentials") };
  }

  const token = signToken({ userId: user.id, email: user.email });
  const { password: _, ...safeUser } = user;
  return { status: 200, body: successResponse("Login successful", { user: safeUser, token }) };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
  });
  if (!user) {
    return { status: 404, body: errorResponse("User not found") };
  }
  return { status: 200, body: successResponse("OK", user) };
}
