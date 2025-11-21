import { handleCodeInterpreter } from './code-interpreter';
import { handleWebBrowser } from './web-browser';

export const registry: Record<string, (input: any) => Promise<any>> = {
  'code_interpreter': handleCodeInterpreter,
  'web_browser': handleWebBrowser,
};
