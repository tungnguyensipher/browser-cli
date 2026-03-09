import os from "node:os";
import path from "node:path";

export function shortenHomePath(value: string): string {
  const home = os.homedir();
  if (!home) {
    return value;
  }
  const normalizedHome = path.resolve(home);
  const normalizedValue = path.resolve(value);
  return normalizedValue.startsWith(normalizedHome)
    ? `~${normalizedValue.slice(normalizedHome.length)}`
    : value;
}
