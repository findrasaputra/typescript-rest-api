import { t } from "elysia";

export function successResponse(message: string, data?: unknown) {
  return { success: true, message, data: data ?? null };
}

export function errorResponse(message: string) {
  return { success: false, message, data: null };
}

export function successSchema(message: string, data?: unknown) {
  return t.Object({
    success: t.Boolean({ example: true }),
    message: t.String({ example: message }),
    data: t.Any({ example: data }),
  });
}

export function errorSchema(message: string) {
  return t.Object({
    success: t.Boolean({ example: false }),
    message: t.String({ example: message }),
    data: t.Null({ example: null }),
  });
}
