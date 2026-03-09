import { createServer } from "node:http";
import net from "node:net";
import { once } from "node:events";
import WebSocket from "ws";

function writeUpgradeRejection(socket, status, bodyText, destroyAfterEnd = false) {
  const body = Buffer.from(bodyText);
  socket.write(
    `HTTP/1.1 ${status} Unauthorized\r\n` +
      "Content-Type: text/plain; charset=utf-8\r\n" +
      `Content-Length: ${body.length}\r\n` +
      "Connection: close\r\n" +
      "\r\n",
  );
  socket.write(body);
  socket.end();
  if (destroyAfterEnd) {
    socket.destroy();
  }
}

async function requestRawUpgrade(port) {
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let data = "";

    socket.once("connect", () => {
      socket.write(
        [
          "GET /cdp HTTP/1.1",
          `Host: 127.0.0.1:${port}`,
          "Connection: Upgrade",
          "Upgrade: websocket",
          "Sec-WebSocket-Version: 13",
          "Sec-WebSocket-Key: dGVzdC1rZXktZm9yLXJlbGF5IQ==",
          "",
          "",
        ].join("\r\n"),
      );
    });

    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
    });
    socket.once("error", reject);
    socket.once("close", () => resolve(data));
  });
}

async function requestWsUpgrade(port) {
  return await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/cdp`);

    ws.once("unexpected-response", (_req, res) => {
      resolve({
        event: "unexpected-response",
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
      });
    });

    ws.once("error", (err) => {
      resolve({
        event: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    });

    ws.once("open", () => {
      resolve({ event: "open" });
      ws.close();
    });
  });
}

async function runCase(name, destroyAfterEnd) {
  const server = createServer((req, res) => {
    res.writeHead(404);
    res.end("not found");
  });

  server.on("upgrade", (_req, socket) => {
    writeUpgradeRejection(socket, 401, "Unauthorized", destroyAfterEnd);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const [rawResponse, wsResult] = await Promise.all([
    requestRawUpgrade(port),
    requestWsUpgrade(port),
  ]);

  await new Promise((resolve) => server.close(resolve));

  return { name, rawResponse, wsResult };
}

const results = [];
results.push(await runCase("end-only", false));
results.push(await runCase("end-and-destroy", true));

console.log(JSON.stringify(results, null, 2));
