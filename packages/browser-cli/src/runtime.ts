export const defaultRuntime = {
  log(message: string): void {
    console.log(message);
  },
  error(message: string): void {
    console.error(message);
  },
  exit(code: number): never {
    process.exit(code);
  },
};
