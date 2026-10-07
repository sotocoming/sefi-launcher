import fs from 'fs';
import path from 'path';
import * as nbt from 'prismarine-nbt';

export interface ServerEntry {
  name: string;
  ip: string;
  acceptTextures?: boolean;
}

/**
 * Ensures the specified server is in Minecraft's servers.dat file.
 * If servers.dat does not exist, creates it.
 * If server is already present (by ip/address), updates or retains it without duplicating.
 */
export async function ensureServerInServersDat(
  gameDirectory: string,
  serverName: string,
  serverAddress: string
): Promise<void> {
  const serversDatPath = path.join(gameDirectory, 'servers.dat');

  try {
    if (!fs.existsSync(gameDirectory)) {
      fs.mkdirSync(gameDirectory, { recursive: true });
    }

    let serversList: any[] = [];

    if (fs.existsSync(serversDatPath)) {
      try {
        const fileBuffer = fs.readFileSync(serversDatPath);
        const parsed: any = await nbt.parse(fileBuffer);
        const rootVal = parsed?.parsed?.value || parsed?.value;
        const listVal = rootVal?.servers?.value?.value;
        if (Array.isArray(listVal)) {
          serversList = listVal;
        }
      } catch (readErr) {
        console.warn('Failed to parse existing servers.dat, creating a fresh one:', readErr);
        serversList = [];
      }
    }

    // Check if the server already exists by address OR by server name
    const normalizedTargetIp = serverAddress.trim().toLowerCase();
    const normalizedTargetName = serverName.trim().toLowerCase();

    const existingIndex = serversList.findIndex((item: any) => {
      const ip = (item?.ip?.value ?? item?.ip ?? '').toString().trim().toLowerCase();
      const name = (item?.name?.value ?? item?.name ?? '').toString().trim().toLowerCase();
      // Matches if same address or same server brand/name
      return ip === normalizedTargetIp || name === normalizedTargetName;
    });

    const newServerNbtItem = {
      name: { type: 'string', value: serverName },
      ip: { type: 'string', value: serverAddress },
      acceptTextures: { type: 'byte', value: 1 },
    };

    if (existingIndex >= 0) {
      // Server already exists: update both name and IP to latest from remote config
      serversList[existingIndex].name = { type: 'string', value: serverName };
      serversList[existingIndex].ip = { type: 'string', value: serverAddress };
      if (!serversList[existingIndex].acceptTextures) {
        serversList[existingIndex].acceptTextures = { type: 'byte', value: 1 };
      }
    } else {
      // Add our server at the very TOP of the server list so players see it first!
      serversList.unshift(newServerNbtItem);
    }

    const nbtData: any = {
      type: 'compound',
      name: '',
      value: {
        servers: {
          type: 'list',
          value: {
            type: 'compound',
            value: serversList,
          },
        },
      },
    };

    // Serialize uncompressed (Minecraft servers.dat is uncompressed NBT)
    const outputBuffer = nbt.writeUncompressed(nbtData);
    fs.writeFileSync(serversDatPath, outputBuffer);
    console.log(`[ServersDat] Successfully ensured server "${serverName}" (${serverAddress}) in servers.dat`);
  } catch (err) {
    console.error('[ServersDat] Failed to update servers.dat:', err);
  }
}
