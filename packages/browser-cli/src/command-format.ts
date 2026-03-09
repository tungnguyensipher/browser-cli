export function formatCliCommand(command: string): string {
  return command.replace(/\bopenclaw browser\b/g, "aibrowser").replace(/\bopenclaw\b/g, "aibrowser");
}
