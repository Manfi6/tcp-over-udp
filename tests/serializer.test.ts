import test from "node:test";
import assert from "node:assert/strict";
import { serializePacket, deserializePacket } from "../src/protocol/serializer";

test("DATA packet round-trip", () => {
  const original = { type: "DATA" as const, seq: 42, data: Buffer.from("hello") };
  const result = deserializePacket(serializePacket(original));
  assert.equal(result.type, "DATA");
  if (result.type === "DATA") {
    assert.equal(result.seq, 42);
    assert.equal(result.data.toString(), "hello");
  }
});

test("ACK packet round-trip", () => {
  const result = deserializePacket(serializePacket({ type: "ACK", ack: 7 }));
  assert.deepEqual(result, { type: "ACK", ack: 7 });
});

test("FIN packet round-trip", () => {
  const result = deserializePacket(serializePacket({ type: "FIN", seq: 9 }));
  assert.deepEqual(result, { type: "FIN", seq: 9 });
});

test("rejects too-small buffer", () => {
  assert.throws(() => deserializePacket(Buffer.alloc(3)), /too small/);
});

test("rejects corrupted packet (checksum mismatch)", () => {
  const buf = serializePacket({ type: "DATA", seq: 1, data: Buffer.from("abc") });
  buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
  assert.throws(() => deserializePacket(buf), /checksum/);
});

test("rejects unknown packet type", () => {
  const buf = serializePacket({ type: "ACK", ack: 1 });
  buf.writeUInt8(99, 0);
  assert.throws(() => deserializePacket(buf));
});