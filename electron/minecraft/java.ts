import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DownloadProgress } from '../../src/types';

const execAsync = promisify(exec);

export async function checkJava17(): Promise<string | null> {
  try {
    const { stdout, stderr } = await execAsync('java -version');
    const output = stdout + stderr;
    if (output.includes('version "17') || output.includes('version "21')) {
      return 'java';
    }
  } catch (e) {
  }
  
  if (process.env.JAVA_HOME) {
    const javaHomePath = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    try {
      const { stdout, stderr } = await execAsync(`"${javaHomePath}" -version`);
      const output = stdout + stderr;
      if (output.includes('version "17') || output.includes('version "21')) {
        return javaHomePath;
      }
    } catch (e) {
    }
  }
  
  return null;
}

export async function downloadJava(onProgress: (p: DownloadProgress) => void): Promise<string> {
  if (process.platform === 'win32') {
    onProgress({
      stage: 'java',
      task: 'Downloading Java 17 via winget',
      total: 100,
      downloaded: 0,
      percentage: 0
    });
    try {
      await execAsync('winget install --id EclipseAdoptium.Temurin.17.JDK -e --accept-package-agreements --accept-source-agreements');
    } catch (e) {
      console.error('Winget failed', e);
    }
    onProgress({
      stage: 'java',
      task: 'Downloaded Java 17',
      total: 100,
      downloaded: 100,
      percentage: 100
    });
    return 'java'; 
  }
  return 'java';
}

export async function getJavaPath(onProgress?: (p: DownloadProgress) => void): Promise<string> {
  const java = await checkJava17();
  if (java) return java;
  
  if (onProgress) {
    return await downloadJava(onProgress);
  }
  
  return 'java';
}
