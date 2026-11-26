export type JsonObject = Record<string, unknown>

export function object(input: unknown): JsonObject | undefined {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as JsonObject : undefined
}

export function field(input: JsonObject | undefined, key: string): unknown {
  return input && Object.hasOwn(input, key) ? input[key] : undefined
}
