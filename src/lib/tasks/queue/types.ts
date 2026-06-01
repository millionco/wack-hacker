import type { z } from "zod";

export interface TaskHandler<T = unknown> {
  name: string;
  schema: z.ZodType<T>;
  handle(payload: T): Promise<void>;
}

export interface TaskEnvelope {
  task: string;
  payload: unknown;
  recurring?: {
    delaySeconds: number;
    maxRepetitions?: number;
    repetitionCount?: number;
  };
}
