import Elysia, { t } from "elysia";
import { verifyToken } from "~middlewares/auth";
import { successSchema, errorSchema } from "~utils/response";
import { register, login, me } from "./handler";

const tags = ["Auth"];

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body, set }) => {
      const result = await register(body);
      set.status = result.status;
      return result.body;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, example: "Alice" }),
        email: t.String({ format: "email", example: "alice@example.com" }),
        password: t.String({ minLength: 8, example: "password123" }),
      }),
      response: {
        201: successSchema("Registration successful"),
        409: errorSchema("Email already in use"),
      },
      detail: { tags, summary: "Register a new user" },
    }
  )
  .post(
    "/login",
    async ({ body, set }) => {
      const result = await login(body);
      set.status = result.status;
      return result.body;
    },
    {
      body: t.Object({
        email: t.String({ format: "email", example: "alice@example.com" }),
        password: t.String({ example: "password123" }),
      }),
      response: {
        200: successSchema("Login successful"),
        401: errorSchema("Invalid credentials"),
      },
      detail: { tags, summary: "Login and receive a JWT" },
    }
  )
  .use(verifyToken)
  .get(
    "/me",
    async ({ userId, set }) => {
      const result = await me(userId);
      set.status = result.status;
      return result.body;
    },
    {
      response: {
        200: successSchema("OK"),
        404: errorSchema("User not found"),
      },
      detail: {
        tags,
        summary: "Get the authenticated user's profile",
        security: [{ bearerAuth: [] }],
      },
    }
  );
