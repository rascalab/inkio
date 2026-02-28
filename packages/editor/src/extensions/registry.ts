import type { AnyExtension, Extensions } from '@tiptap/core';

export type InkioExtensionCategory = 'block' | 'inline' | 'mark' | 'utility' | (string & {});

export interface InkioExtensionRegistry {
  register: (...extensions: AnyExtension[]) => void;
  unregister: (extensionName: string) => void;
  clear: () => void;
  getExtensions: () => Extensions;
  configure: (name: string, options: Record<string, any>) => void;
  setCategory: (name: string, category: InkioExtensionCategory) => void;
  getCategory: (name: string) => InkioExtensionCategory | undefined;
  getCategories: () => Record<string, InkioExtensionCategory>;
}

type ConfigurableExtension = AnyExtension & {
  configure?: (options: Record<string, any>) => AnyExtension;
};

type ExtensionWithMetadata = AnyExtension & {
  name?: string;
  type?: string;
  config?: {
    group?: string;
    inline?: boolean;
  };
};

function normalizeExtensions(extensions: Extensions): AnyExtension[] {
  return (extensions as AnyExtension[]).filter(Boolean);
}

function isDevEnvironment(): boolean {
  const metaEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean; MODE?: string } }).env;
  if (typeof metaEnv?.DEV === 'boolean') {
    return metaEnv.DEV;
  }
  if (typeof metaEnv?.MODE === 'string') {
    return metaEnv.MODE !== 'production';
  }
  return true;
}

function inferCategory(extension: AnyExtension): InkioExtensionCategory {
  const metadata = extension as ExtensionWithMetadata;
  if (typeof metadata.type === 'string') {
    if (metadata.type === 'mark') {
      return 'mark';
    }
    if (metadata.type === 'node') {
      const isInline = metadata.config?.inline || metadata.config?.group === 'inline';
      return isInline ? 'inline' : 'block';
    }
  }
  return 'utility';
}

export function createInkioExtensionRegistry(initial: Extensions = []): InkioExtensionRegistry {
  const map = new Map<string, AnyExtension>();
  const anonymous: AnyExtension[] = [];
  const categories = new Map<string, InkioExtensionCategory>();
  const manualCategoryOverrides = new Set<string>();

  const register = (...extensions: AnyExtension[]) => {
    for (const extension of extensions.filter(Boolean)) {
      if (extension && typeof extension === 'object' && 'name' in extension && extension.name) {
        const extensionName = String(extension.name);
        if (map.has(extensionName) && isDevEnvironment()) {
          console.warn(
            `[inkio] Extension "${extensionName}" is already registered and will be replaced by the latest registration.`
          );
        }

        map.set(extensionName, extension);
        if (!manualCategoryOverrides.has(extensionName)) {
          categories.set(extensionName, inferCategory(extension));
        }
        continue;
      }
      anonymous.push(extension);
    }
  };

  const unregister = (extensionName: string) => {
    map.delete(extensionName);
    categories.delete(extensionName);
    manualCategoryOverrides.delete(extensionName);
  };

  const clear = () => {
    map.clear();
    anonymous.length = 0;
    categories.clear();
    manualCategoryOverrides.clear();
  };

  const getExtensions = () => {
    return Array.from(map.values()).concat(anonymous) as Extensions;
  };

  const configure = (name: string, options: Record<string, any>) => {
    const registeredExtension = map.get(name);
    if (!registeredExtension) {
      return;
    }

    const configurableExtension = registeredExtension as ConfigurableExtension;
    if (typeof configurableExtension.configure !== 'function') {
      if (isDevEnvironment()) {
        console.warn(`[inkio] Extension "${name}" does not support configure() and was left unchanged.`);
      }
      return;
    }

    const configuredExtension = configurableExtension.configure(options);
    map.set(name, configuredExtension);

    if (!manualCategoryOverrides.has(name)) {
      categories.set(name, inferCategory(configuredExtension));
    }
  };

  const setCategory = (name: string, category: InkioExtensionCategory) => {
    if (!map.has(name)) {
      return;
    }

    categories.set(name, category);
    manualCategoryOverrides.add(name);
  };

  const getCategory = (name: string) => {
    return categories.get(name);
  };

  const getCategories = () => {
    return Object.fromEntries(categories.entries()) as Record<string, InkioExtensionCategory>;
  };

  register(...normalizeExtensions(initial));

  return {
    register,
    unregister,
    clear,
    getExtensions,
    configure,
    setCategory,
    getCategory,
    getCategories,
  };
}
