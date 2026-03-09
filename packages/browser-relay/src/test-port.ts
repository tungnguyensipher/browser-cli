import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export async function getFreePort(): Promise<number> {
  while (true) {
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const assigned = (server.address() as AddressInfo).port;
        server.close((err) => (err ? reject(err) : resolve(assigned)));
      });
    });
    if (port < 65535) {
      return port;
    }
  }
}
