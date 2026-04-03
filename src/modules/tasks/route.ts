import Elysia, { t } from "elysia";
import { verifyToken } from "~middlewares/auth";
import { successSchema, errorSchema } from "~utils/response";
import { listTasks, getTask, createTask, updateTask, deleteTask } from "./handler";

const tags = ["Tasks"];

const TaskStatusEnum = t.Union([
  t.Literal("TODO"),
  t.Literal("IN_PROGRESS"),
  t.Literal("DONE"),
]);

export const taskRoutes = new Elysia({ prefix: "/tasks" })
  .use(verifyToken)
  .get(
    "/",
    async ({ userId, query, set }) => {
      const result = await listTasks(userId, query);
      set.status = result.status;
      return result.body;
    },
    {
      query: t.Object({
        page: t.Optional(t.String({ example: "1" })),
        size: t.Optional(t.String({ example: "20" })),
        status: t.Optional(TaskStatusEnum),
      }),
      response: {
        200: successSchema("OK"),
      },
      detail: {
        tags,
        summary: "List tasks (paginated, Redis-cached)",
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .get(
    "/:id",
    async ({ userId, params, set }) => {
      const result = await getTask(userId, params.id);
      set.status = result.status;
      return result.body;
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: successSchema("OK"),
        404: errorSchema("Task not found"),
      },
      detail: {
        tags,
        summary: "Get a single task by ID",
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .post(
    "/",
    async ({ userId, body, set }) => {
      const result = await createTask(userId, body);
      set.status = result.status;
      return result.body;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, example: "Write unit tests" }),
        description: t.Optional(t.String({ example: "Cover all edge cases" })),
        status: t.Optional(TaskStatusEnum),
        dueDate: t.Optional(t.String({ format: "date-time", example: "2026-05-01T00:00:00Z" })),
      }),
      response: {
        201: successSchema("Task created"),
      },
      detail: {
        tags,
        summary: "Create a new task",
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .patch(
    "/:id",
    async ({ userId, params, body, set }) => {
      const result = await updateTask(userId, params.id, body);
      set.status = result.status;
      return result.body;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, example: "Updated title" })),
        description: t.Optional(t.String()),
        status: t.Optional(TaskStatusEnum),
        dueDate: t.Optional(t.String({ format: "date-time" })),
      }),
      response: {
        200: successSchema("Task updated"),
        404: errorSchema("Task not found"),
      },
      detail: {
        tags,
        summary: "Update a task",
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .delete(
    "/:id",
    async ({ userId, params, set }) => {
      const result = await deleteTask(userId, params.id);
      set.status = result.status;
      return result.body;
    },
    {
      params: t.Object({ id: t.String() }),
      response: {
        200: successSchema("Task deleted"),
        404: errorSchema("Task not found"),
      },
      detail: {
        tags,
        summary: "Delete a task",
        security: [{ bearerAuth: [] }],
      },
    }
  );
