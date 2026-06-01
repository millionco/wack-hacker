const MAX_VALUE_LEN = 200;

function formatValue(v: unknown): string {
  if (v === undefined) return "undefined";
  let s: string;
  try {
    s = JSON.stringify(v);
  } catch {
    // Circular / non-serializable payload — show a placeholder rather than
    // relying on `String(v)`, which produces `[object Object]` for most
    // structured values.
    s = "<unserializable>";
  }
  if (s.length <= MAX_VALUE_LEN) return s;
  const wrapped = s.at(0) === '"';
  const body = wrapped ? s.slice(1, MAX_VALUE_LEN - 2) : s.slice(0, MAX_VALUE_LEN - 1);
  return wrapped ? `"${body}…"` : `${body}…`;
}

/**
 * Render a python-style dot-notation call for display in the approval prompt.
 * Strips the wrapper-injected `_reason` field so the agent's justification
 * doesn't clutter the visible parameters.
 *
 * - With `delegateName`: `delegate_<name>.<tool>(\n    k=v,\n)`.
 * - Without: `<tool>(\n    k=v,\n)`.
 * - Empty params: `<tool>()`.
 */
export function formatToolCall(
  delegateName: string | undefined,
  toolName: string,
  input: unknown,
): string {
  const obj =
    input && typeof input === "object" && !Array.isArray(input)
      ? { ...(input as Record<string, unknown>) }
      : {};
  delete obj._reason;

  const prefix = delegateName ? `delegate_${delegateName}.${toolName}` : toolName;
  const entries = Object.entries(obj);
  if (entries.length === 0) return `${prefix}()`;

  const lines = entries.map(([k, v]) => `    ${k}=${formatValue(v)},`).join("\n");
  return `${prefix}(\n${lines}\n)`;
}
