import { createClient } from "redis";

export const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST ?? "localhost"}:6379`,
});

redisClient.on("connect", () => console.log("Connected to Redis"));
redisClient.on("error", (err) => console.error("Redis client error", err));

export async function getRedisClient(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

const TASK_TTL_SECONDS = 3600; // 1 hour

/**
 * Cache a task by its id. Used to speed up single-record lookups.
 */
export async function cacheTask(task: { id: string; [key: string]: unknown }): Promise<void> {
  const client = await getRedisClient();
  const key = `task:${task.id}`;
  await client.set(key, JSON.stringify(task), { EX: TASK_TTL_SECONDS });

  // Maintain a sorted set of task ids keyed by creation timestamp for list queries.
  const score = task.createdAt instanceof Date
    ? task.createdAt.getTime()
    : new Date(task.createdAt as string).getTime();

  await client.zAdd("tasks", { score, value: task.id as string });
  // Expire old entries beyond the TTL window
  const expiredScore = score - TASK_TTL_SECONDS * 1000;
  await client.zRemRangeByScore("tasks", "-inf", expiredScore);
}

/**
 * Retrieve a single cached task by id. Returns null on cache miss.
 */
export async function getCachedTask(id: string): Promise<Record<string, unknown> | null> {
  const client = await getRedisClient();
  const value = await client.get(`task:${id}`);
  return value ? JSON.parse(value) : null;
}

/**
 * Invalidate the cache entry for a task (on update or delete).
 */
export async function invalidateTask(id: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(`task:${id}`);
  await client.zRem("tasks", id);
}

/**
 * Retrieve a paginated list of task ids from the sorted set, newest first.
 */
export async function getCachedTaskList(
  page: number,
  size: number
): Promise<{ ids: string[]; total: number }> {
  const client = await getRedisClient();
  const total = await client.zCard("tasks");
  const offset = (page - 1) * size;
  const ids = await client.zRange("tasks", "+inf", "-inf", {
    BY: "SCORE",
    REV: true,
    LIMIT: { offset, count: size },
  });
  return { ids, total };
}
