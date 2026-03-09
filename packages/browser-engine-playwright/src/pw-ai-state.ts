let loaded = false;

export function markPwAiLoaded(): void {
  loaded = true;
}

export function isPwAiLoaded(): boolean {
  return loaded;
}
