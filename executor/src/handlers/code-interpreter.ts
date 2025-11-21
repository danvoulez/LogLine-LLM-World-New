import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execPromise = promisify(exec);

interface CodeInterpreterInput {
  language: 'python' | 'javascript';
  code: string;
}

export async function handleCodeInterpreter(input: CodeInterpreterInput): Promise<{ stdout: string; stderr: string; error?: string }> {
  const { language, code } = input;
  
  // Basic validation
  if (!['python', 'javascript'].includes(language)) {
    return { stdout: '', stderr: 'Unsupported language', error: 'Unsupported language' };
  }

  const extension = language === 'python' ? 'py' : 'js';
  const filename = `/tmp/script_${Date.now()}.${extension}`;
  const command = language === 'python' ? `python3 ${filename}` : `node ${filename}`;

  try {
    // Write code to a temporary file
    await fs.writeFile(filename, code);

    const { stdout, stderr } = await execPromise(command, { timeout: 30000 }); // 30 seconds timeout

    // Cleanup
    await fs.unlink(filename);

    return { stdout, stderr };
  } catch (error: any) {
    // Try cleanup
    try { await fs.unlink(filename); } catch {}

    return { stdout: error.stdout || '', stderr: error.stderr || '', error: error.message };
  }
}
