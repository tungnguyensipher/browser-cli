const BUFFER_SENTINEL = "__aibrowserType";
const BUFFER_SENTINEL_VALUE = "Buffer";

export function serializeNodeWorkerValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return {
      [BUFFER_SENTINEL]: BUFFER_SENTINEL_VALUE,
      base64: value.toString("base64"),
    };
  }
  if (ArrayBuffer.isView(value)) {
    return {
      [BUFFER_SENTINEL]: BUFFER_SENTINEL_VALUE,
      base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64"),
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeNodeWorkerValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeNodeWorkerValue(entry)]));
}
