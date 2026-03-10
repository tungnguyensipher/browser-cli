export function formatCliCommand(command: string): string {
  return command.replace(/\bopenclaw browser\b/g, "browser-cli").replace(/\bopenclaw\b/g, "browser-cli");
}
