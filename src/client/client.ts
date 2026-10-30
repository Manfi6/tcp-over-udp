import dgram from "dgram";
import { DataPacket, FinPacket, Packet } from "../protocol/packet";
import { serializePacket, deserializePacket } from "../protocol/serializer";
import { CHUNK_SIZE, HOST, MAX_RETRIES, PORT, TIMEOUT_MS, shouldDrop } from "../config";

const client = dgram.createSocket("udp4");

function splitData(data: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.subarray(i, i + CHUNK_SIZE));
  }
  return chunks;
}

function createPackets(data: Buffer): DataPacket[] {
  return splitData(data).map((chunk, i) => ({
    type: "DATA" as const,
    seq: i + 1,
    data: chunk,
  }));
}

function sendReliable(packet: DataPacket | FinPacket): Promise<void> {
  return new Promise((resolve, reject) => {
    const seq = packet.seq;
    const buffer = serializePacket(packet);
    let attempts = 0;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      client.off("message", onMessage);
    };

    const onMessage = (msg: Buffer) => {
      if (shouldDrop()) {
        console.log("Simulated loss: incoming ACK dropped");
        return;
      }

      let reply: Packet;
      try {
        reply = deserializePacket(msg);
      } catch {
        return;
      }

      if (reply.type !== "ACK" || reply.ack !== seq) {
        return;
      }

      console.log(`ACK Received for Packet ${reply.ack}`);
      cleanup();
      resolve();
    };

    const attempt = () => {
      if (attempts > MAX_RETRIES) {
        cleanup();
        reject(new Error(`No ACK for packet ${seq} after ${MAX_RETRIES} retries`));
        return;
      }

      if (attempts > 0) {
        console.log(`Timeout! Retrying packet ${seq}... Attempt ${attempts}`);
      }
      attempts++;

      if (shouldDrop()) {
        console.log(`Simulated loss: packet ${seq} dropped`);
      } else {
        client.send(buffer, PORT, HOST, (err) => {
          if (err) console.error("Failed to send packet:", err);
        });
      }

      timer = setTimeout(attempt, TIMEOUT_MS);
    };

    client.on("message", onMessage);
    attempt();
  });
}

async function main(): Promise<void> {
  const message = process.argv.slice(2).join(" ") || "Hello Server";
  const packets = createPackets(Buffer.from(message));

  console.log(`Sending "${message}" in ${packets.length} packet(s)`);

  for (const packet of packets) {
    await sendReliable(packet);
  }

  await sendReliable({ type: "FIN", seq: packets.length + 1 });

  console.log("Message delivered successfully");
}

client.on("error", (err) => console.error("Client error:", err));

main()
  .catch((err) => {
    console.error("Connection Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.close());