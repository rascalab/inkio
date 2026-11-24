import { createLowlight, type LanguageFn } from 'lowlight';

export interface InkioLowlight {
  highlight(language: string, source: string): { children: unknown[] };
  highlightAuto(source: string): { children: unknown[] };
  registered(language: string): boolean;
  register(name: string, grammar: LanguageFn): void;
  registerAlias(aliases: Record<string, string[]>): void;
}

// Import the factory by name so the async chunk does not include lowlight's
// `all` and `common` grammar collections.
export const lowlight: InkioLowlight = createLowlight();
