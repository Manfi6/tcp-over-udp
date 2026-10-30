# TCP over UDP

A small reliable-data-transfer protocol built on top of UDP in TypeScript.
It implements **Stop-and-Wait ARQ**: every packet must be acknowledged before the next one is sent, and lost packets are retransmitted after a timeout.

I built this project to learn how reliability works under the hood in protocols like TCP.

## Features

- Message split into chunks, each sent as a numbered `DATA` packet
- `ACK` for every packet, with **timeout + retransmission** (configurable max retries)
- Server-side **duplicate detection** and **in-order delivery**
- **Per-client sessions** (keyed by `address:port`) with idle cleanup
- `FIN` packet to mark the end of a message
- **CRC32 checksum**: corrupted packets are detected and dropped
- Malformed packets never crash the server
- **Packet-loss simulator** (`LOSS_RATE`) to demonstrate reliability
- Unit tests for the serializer

## Packet format

```
 0        1                5                9
 +--------+----------------+----------------+----------------+
 |  type  |  seq / ack     |   CRC32        |   payload ...  |
 | 1 byte |    4 bytes     |   4 bytes      |   (DATA only)  |
 +--------+----------------+----------------+----------------+

 type: 1 = DATA, 2 = ACK, 3 = FIN        (big-endian integers)
```

## How it works

```
Client                         Server
  |--- DATA seq=1 ------------>|
  |<-- ACK 1 ------------------|
  |--- DATA seq=2 --X (lost)   |
  |   ... timeout ...          |
  |--- DATA seq=2 (retry) ---->|
  |<-- ACK 2 ------------------|
  |--- FIN seq=3 ------------->|   server prints the full message
  |<-- ACK 3 ------------------|
```

If an ACK is lost, the client retransmits the same packet. The server detects
the duplicate (its sequence number is lower than the expected one), skips
processing it, and just re-sends the ACK.

## Project structure

```
src/
  config.ts            settings (port, timeout, loss rate...)
  protocol/
    packet.ts          packet types
    serializer.ts      packet <-> bytes
    crc32.ts           checksum
  server/server.ts     receiver
  client/client.ts     sender
tests/
  serializer.test.ts
```

## Getting started

```bash
git clone https://github.com/Manfi6/tcp-over-udp.git
cd tcp-over-udp
npm install
```

Run the server in one terminal:

```bash
npm run server
```

Send a message from another terminal:

```bash
npm run client -- "Hello from the client"
```

### Simulate a lossy network

Linux / macOS:

```bash
LOSS_RATE=0.3 TIMEOUT_MS=200 npm run server
LOSS_RATE=0.3 TIMEOUT_MS=200 MAX_RETRIES=15 npm run client -- "Reliable over lossy UDP"
```

Windows (PowerShell):

```powershell
$env:LOSS_RATE="0.3"; $env:TIMEOUT_MS="200"; npm run server
```

You will see dropped packets, timeouts, retransmissions and duplicate detection,
and the message still arrives complete and in order.

## Configuration

All settings are environment variables:

| Variable      | Default     | Description                            |
|---------------|-------------|----------------------------------------|
| `PORT`        | `3000`      | Server port                            |
| `HOST`        | `localhost` | Server host (client side)              |
| `TIMEOUT_MS`  | `500`       | Retransmission timeout                 |
| `MAX_RETRIES` | `5`         | Retries before giving up               |
| `CHUNK_SIZE`  | `5`         | Payload bytes per packet               |
| `LOSS_RATE`   | `0`         | Probability (0-1) of dropping a packet |

## Tests

```bash
npm test
```

## Limitations / Future work

- No connection handshake (SYN / SYN-ACK)
- Stop-and-Wait only: one packet in flight at a time (no sliding window)
- No flow control or congestion control
- Fixed timeout (no RTT estimation)
# TCPoverUDP
