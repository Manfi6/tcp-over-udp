export interface DataPacket {
  type: "DATA";
  seq: number;
  data: Buffer;
}

export interface AckPacket {
  type: "ACK";
  ack: number;
}

export interface FinPacket {
  type: "FIN";
  seq: number;
}

export type Packet = DataPacket | AckPacket | FinPacket;