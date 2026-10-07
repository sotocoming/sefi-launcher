import net from 'net';
import type { ServerStatus } from '../src/types';

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  while (true) {
    if ((value & ~0x7f) === 0) {
      bytes.push(value);
      break;
    }
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  return Buffer.from(bytes);
}

function readVarInt(buffer: Buffer, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let b: number;
  do {
    if (offset >= buffer.length) throw new Error('Buffer underflow');
    b = buffer[offset++];
    value |= (b & 0x7f) << shift;
    shift += 7;
  } while ((b & 0x80) !== 0);
  return [value, offset];
}

export function getServerStatus(): Promise<ServerStatus> {
  const host = 'sotocoming.ru';
  const port = 25565;
  const offline: ServerStatus = {
    online: false, players: 0, maxPlayers: 0, motd: 'Сервер недоступен', version: '',
  };

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      // Build handshake: protocol=-1, host, port, nextState=1 (status)
      const hostBuf = Buffer.from(host, 'utf-8');
      const handshakePayload = Buffer.concat([
        writeVarInt(0x00),             // Packet ID
        writeVarInt(-1),               // Protocol version (-1 = let server decide)
        writeVarInt(hostBuf.length),   // Host length
        hostBuf,                       // Host
        Buffer.from([(port >> 8) & 0xff, port & 0xff]), // Port (unsigned short BE)
        writeVarInt(1),                // Next state: status
      ]);

      const handshakePacket = Buffer.concat([writeVarInt(handshakePayload.length), handshakePayload]);

      // Status request: packet ID 0x00, zero-length payload
      const statusPayload = writeVarInt(0x00);
      const statusPacket = Buffer.concat([writeVarInt(statusPayload.length), statusPayload]);

      socket.write(Buffer.concat([handshakePacket, statusPacket]));
    });

    socket.setTimeout(5000);
    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      try {
        const [packetLen, offset1] = readVarInt(buffer, 0);
        if (buffer.length < offset1 + packetLen) return; // Wait for more data

        const [packetId, offset2] = readVarInt(buffer, offset1);
        if (packetId !== 0x00) return;

        const [strLen, offset3] = readVarInt(buffer, offset2);
        const jsonStr = buffer.toString('utf-8', offset3, offset3 + strLen);
        const response = JSON.parse(jsonStr);

        socket.end();

        // Parse MOTD (can be string or chat component)
        let motd = 'Minecraft Server';
        if (typeof response.description === 'string') {
          motd = response.description;
        } else if (response.description?.text) {
          motd = response.description.text;
          if (response.description.extra) {
            motd += response.description.extra.map((e: any) => e.text || '').join('');
          }
        }

        resolve({
          online: true,
          players: response.players?.online ?? 0,
          maxPlayers: response.players?.max ?? 0,
          motd,
          version: response.version?.name ?? '1.20.1',
          favicon: response.favicon,
        });
      } catch {
        // Incomplete packet, wait for more data
      }
    });

    socket.on('error', () => resolve(offline));
    socket.on('timeout', () => { socket.destroy(); resolve(offline); });
  });
}
