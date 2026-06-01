export interface HttpJsonOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  /** Send `body` as application/x-www-form-urlencoded instead of JSON. */
  form?: boolean;
  timeoutMs?: number;
}
