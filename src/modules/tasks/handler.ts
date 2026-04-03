import { prisma } from "~libs/prisma";
import { cacheTask, getCachedTask, getCachedTaskList, invalidateTask } from "~libs/redis";
import { successResponse, errorResponse } from "~utils/response";
import KafkaProducer from "~utils/kafka_producer";

const producer = new KafkaProducer();
producer.start();

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

interface CreateTaskBody {
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
}

interface UpdateTaskBody {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
}

interface ListQuery {
  page?: string;
  size?: string;
  status?: TaskStatus;
}

export async function listTasks(userId: string, query: ListQuery) {
  const page = Math.max(1, parseInt(query.page ?? "1"));
  const size = Math.min(100, Math.max(1, parseInt(query.size ?? "20")));

  // Status filter bypasses Redis (filtered list not cached separately)
  if (query.status) {
    const tasks = await prisma.task.findMany({
      where: { userId, status: query.status },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    });
    const total = await prisma.task.count({ where: { userId, status: query.status } });
    return { status: 200, body: successResponse("OK", { tasks, meta: { page, size, total } }) };
  }

  // Try Redis sorted set for unfiltered list
  const cached = await getCachedTaskList(page, size).catch(() => null);
  if (cached && cached.ids.length > 0) {
    const tasks = await Promise.all(cached.ids.map((id) => getCachedTask(id)));
    const hits = tasks.filter(Boolean);
    if (hits.length === cached.ids.length) {
      return {
        status: 200,
        body: successResponse("OK", { tasks: hits, meta: { page, size, total: cached.total }, source: "cache" }),
      };
    }
  }

  // Fall back to database
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.task.count({ where: { userId } }),
  ]);

  // Warm cache
  await Promise.all(tasks.map((t) => cacheTask(t as Parameters<typeof cacheTask>[0])));

  return { status: 200, body: successResponse("OK", { tasks, meta: { page, size, total } }) };
}

export async function getTask(userId: string, taskId: string) {
  const cached = await getCachedTask(taskId).catch(() => null);
  if (cached && cached["userId"] === userId) {
    return { status: 200, body: successResponse("OK", cached) };
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) {
    return { status: 404, body: errorResponse("Task not found") };
  }

  await cacheTask(task as Parameters<typeof cacheTask>[0]);
  return { status: 200, body: successResponse("OK", task) };
}

export async function createTask(userId: string, body: CreateTaskBody) {
  const task = await prisma.task.create({
    data: {
      userId,
      title: body.title,
      description: body.description,
      status: body.status ?? "TODO",
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
  });

  await cacheTask(task as Parameters<typeof cacheTask>[0]);
  await producer.send({ type: "task.created", payload: task }).catch(console.error);

  return { status: 201, body: successResponse("Task created", task) };
}

export async function updateTask(userId: string, taskId: string, body: UpdateTaskBody) {
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!existing) {
    return { status: 404, body: errorResponse("Task not found") };
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
  });

  await cacheTask(task as Parameters<typeof cacheTask>[0]);
  await producer.send({ type: "task.updated", payload: task }).catch(console.error);

  return { status: 200, body: successResponse("Task updated", task) };
}

export async function deleteTask(userId: string, taskId: string) {
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!existing) {
    return { status: 404, body: errorResponse("Task not found") };
  }

  await prisma.task.delete({ where: { id: taskId } });
  await invalidateTask(taskId);
  await producer.send({ type: "task.deleted", payload: { id: taskId } }).catch(console.error);

  return { status: 200, body: successResponse("Task deleted") };
}
