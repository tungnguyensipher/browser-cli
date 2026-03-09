export function createSubsystemLogger(_name: string) {
  return {
    child: (_childName: string) => ({
      info: (..._args: unknown[]) => {},
      warn: (..._args: unknown[]) => {},
    }),
  };
}
