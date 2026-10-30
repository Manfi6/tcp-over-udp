export const PORT = Number(process.env.PORT ?? 3000);
export const HOST = process.env.HOST ?? "localhost";

export const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 500);
export const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 5);
export const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 5);

export const LOSS_RATE = Number(process.env.LOSS_RATE ?? 0);

export const SESSION_IDLE_MS = 30_000;

export function shouldDrop(): boolean {
  return Math.random() < LOSS_RATE;
}