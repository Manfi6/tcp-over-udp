import { Packet } from "./packet";
import { crc32 } from "./crc32";


export const HEADER_SIZE = 9;

const TYPE_DATA = 1;
const TYPE_ACK = 2;
const TYPE_FIN = 3;

export function serializePacket(packet: Packet): Buffer {
  let code: number;
  let num: number;
  let payload: Buffer = Buffer.alloc(0);

  switch (packet.type) {
    case "DATA":
      code = TYPE_DATA;
      num = packet.seq;
      payload = packet.data;
      break;
    case "ACK":
      code = TYPE_ACK;
      num = packet.ack;
      break;
    case "FIN":
      code = TYPE_FIN;
      num = packet.seq;
      break;
    default:
      throw new Error("Unknown packet type");
  }

  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt8(code, 0);
  header.writeUInt32BE(num, 1);

  const checksum = crc32(Buffer.concat([header.subarray(0, 5), payload]));
  header.writeUInt32BE(checksum, 5);

  return Buffer.concat([header, payload]);
}

export function deserializePacket(buffer: Buffer): Packet {
  if (buffer.length < HEADER_SIZE) {
    throw new Error("Invalid packet: too small");
  }

  const code = buffer.readUInt8(0);
  const num = buffer.readUInt32BE(1);
  const checksum = buffer.readUInt32BE(5);
  const payload = buffer.subarray(HEADER_SIZE);

  const expected = crc32(Buffer.concat([buffer.subarray(0, 5), payload]));
  if (checksum !== expected) {
    throw new Error("Invalid packet: checksum mismatch");
  }

  switch (code) {
    case TYPE_DATA:
      return { type: "DATA", seq: num, data: Buffer.from(payload) };
    case TYPE_ACK:
      return { type: "ACK", ack: num };
    case TYPE_FIN:
      return { type: "FIN", seq: num };
    default:
      throw new Error("Unknown packet type");
  }
}