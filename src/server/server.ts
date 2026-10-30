import dgram from "dgram";
import { AckPacket, Packet } from "../protocol/packet";
import { deserializePacket, serializePacket } from "../protocol/serializer";
import { PORT, SESSION_IDLE_MS, shouldDrop } from "../config";

interface Session {
  expectedSeq: number;
  chunks: Buffer[];
  finished: boolean;
  lastSeen: number;
}

const server = dgram.createSocket("udp4");

const sessions = new Map<string, Session>();

function getSession(key: string): Session {
  let session = sessions.get(key);
  if (!session) {
    session = { expectedSeq: 1, chunks: [], finished: false, lastSeen: Date.now() };
    sessions.set(key, session);
  }
  session.lastSeen = Date.now();
  return session;
}

function sendAck(seq: number, port: number, address: string): void {
  if (shouldDrop()) {
    console.log(`Simulated loss: ACK ${seq} dropped`);
    return;
  }

  const ack: AckPacket = { type: "ACK", ack: seq };

  server.send(serializePacket(ack), port, address, (err) => {
    if (err) {
      console.error("Failed to send ACK:", err);
      return;
    }
    console.log(`ACK Sent for Packet ${seq}`);
  });
}

server.on("listening", () => {
  console.log(`Server is listening on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  server.close();
});

server.on("message", (msg, rinfo) => {
  if (shouldDrop()) {
    console.log("Simulated loss: incoming packet dropped");
    return;
  }

  let packet: Packet;
  try {
    packet = deserializePacket(msg);
  } catch (e) {
    console.error(`Bad packet from ${rinfo.address}:${rinfo.port} dropped:`, (e as Error).message);
    return;
  }

  if (packet.type === "ACK") {
    return;
  }

  const key = `${rinfo.address}:${rinfo.port}`;
  const session = getSession(key);

  if (packet.seq < session.expectedSeq) {
    console.log(`Duplicate Packet ${packet.seq} from ${key}`);
    sendAck(packet.seq, rinfo.port, rinfo.address);
    return;
  }

  if (packet.seq > session.expectedSeq) {
    console.log(`Out-of-order Packet ${packet.seq} (expected ${session.expectedSeq}), dropped`);
    return;
  }

  if (packet.type === "DATA") {
    console.log(`DATA ${packet.seq} from ${key}: "${packet.data.toString()}"`);
    session.chunks.push(packet.data);
    session.expectedSeq++;
  } else if (packet.type === "FIN") {
    const message = Buffer.concat(session.chunks).toString();
    console.log("========== MESSAGE COMPLETE ==========");
    console.log(`From: ${key}`);
    console.log(`Message: "${message}"`);
    session.finished = true;
    session.expectedSeq++;
  }

  sendAck(packet.seq, rinfo.port, rinfo.address);
});

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastSeen > SESSION_IDLE_MS) {
      sessions.delete(key);
    }
  }
}, 5000).unref();

server.bind(PORT);