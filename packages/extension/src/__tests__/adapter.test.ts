import { isExtensionsAdapter, mapExtensionsAdapterToOptions } from '../adapter';
import type { ExtensionsAdapter } from '../adapter';

describe('isExtensionsAdapter', () => {
  it('returns true for object with file adapter key', () => {
    expect(isExtensionsAdapter({ file: {} })).toBe(true);
  });

  it('returns true for object with suggestion adapter key', () => {
    expect(isExtensionsAdapter({ suggestion: {} })).toBe(true);
  });

  it('returns true for object with navigation adapter key', () => {
    expect(isExtensionsAdapter({ navigation: {} })).toBe(true);
  });

  it('returns true for object with comment adapter key', () => {
    expect(isExtensionsAdapter({ comment: {} })).toBe(true);
  });

  it('returns true for object with imageEditor adapter key', () => {
    expect(isExtensionsAdapter({ imageEditor: {} })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isExtensionsAdapter(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isExtensionsAdapter(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isExtensionsAdapter('adapter')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isExtensionsAdapter(42)).toBe(false);
  });

  it('returns false for an empty object (no adapter keys)', () => {
    expect(isExtensionsAdapter({})).toBe(false);
  });

  it('returns false for DefaultInkioExtensionsOptions objects with blockHandle key', () => {
    expect(isExtensionsAdapter({ blockHandle: true })).toBe(false);
  });

  it('returns false for DefaultInkioExtensionsOptions objects with placeholder key', () => {
    expect(isExtensionsAdapter({ placeholder: 'Type...' })).toBe(false);
  });

  it('returns false for DefaultInkioExtensionsOptions objects with onUpload key', () => {
    expect(isExtensionsAdapter({ onUpload: async () => 'url' })).toBe(false);
  });

  it('returns false for DefaultInkioExtensionsOptions objects with mentionItems key', () => {
    expect(isExtensionsAdapter({ mentionItems: () => [] })).toBe(false);
  });

  it('returns false for DefaultInkioExtensionsOptions objects with locale key', () => {
    expect(isExtensionsAdapter({ locale: 'en' })).toBe(false);
  });

  it('returns false when adapter key value is not an object', () => {
    // file key present but value is a string (not an object)
    expect(isExtensionsAdapter({ file: 'not-an-object' })).toBe(false);
  });

  it('returns true when adapter key value is null (allowed - null is typeof object)', () => {
    // null passes typeof !== 'object' check since null passes the outer null check
    // The code checks: candidate[key] !== undefined && typeof candidate[key] !== 'object'
    // null: typeof null === 'object' so it passes
    // Actually let's verify: null is not undefined and typeof null === 'object', so it should pass
    expect(isExtensionsAdapter({ file: null })).toBe(true);
  });
});

describe('mapExtensionsAdapterToOptions', () => {
  it('maps file uploadFile to onUpload wrapper', async () => {
    const adapter: ExtensionsAdapter = {
      file: {
        uploadFile: async () => 'https://example.com/image.png',
      },
    };

    const options = mapExtensionsAdapterToOptions(adapter);
    expect(typeof options.onUpload).toBe('function');

    const url = await options.onUpload!(new File([], 'test.png'));
    expect(url).toBe('https://example.com/image.png');
  });

  it('maps file uploadFile returning object with src', async () => {
    const adapter: ExtensionsAdapter = {
      file: {
        uploadFile: async () => ({ src: 'https://cdn.example.com/img.jpg', width: 800 }),
      },
    };

    const options = mapExtensionsAdapterToOptions(adapter);
    const url = await options.onUpload!(new File([], 'img.jpg'));
    expect(url).toBe('https://cdn.example.com/img.jpg');
  });

  it('returns undefined onUpload when no file adapter', () => {
    const options = mapExtensionsAdapterToOptions({});
    expect(options.onUpload).toBeUndefined();
  });

  it('maps suggestion mentionItems with query wrapper', async () => {
    const mentionItems = vi.fn().mockResolvedValue([{ id: '1', label: 'Alice' }]);
    const adapter: ExtensionsAdapter = {
      suggestion: { mentionItems },
    };

    const options = mapExtensionsAdapterToOptions(adapter);
    expect(typeof options.mentionItems).toBe('function');

    const result = await options.mentionItems!({ query: 'ali' });
    expect(mentionItems).toHaveBeenCalledWith('ali');
    expect(result).toEqual([{ id: '1', label: 'Alice' }]);
  });

  it('returns undefined mentionItems when no suggestion adapter', () => {
    const options = mapExtensionsAdapterToOptions({});
    expect(options.mentionItems).toBeUndefined();
  });

  it('maps navigation onWikiLinkClick', () => {
    const onWikiLinkClick = vi.fn();
    const adapter: ExtensionsAdapter = {
      navigation: { onWikiLinkClick },
    };

    const options = mapExtensionsAdapterToOptions(adapter);
    expect(options.onWikiLinkClick).toBe(onWikiLinkClick);
  });

  it('maps comment adapter directly', () => {
    const comment = { onCommentCreate: vi.fn() };
    const adapter: ExtensionsAdapter = { comment };

    const options = mapExtensionsAdapterToOptions(adapter);
    expect(options.comment).toBe(comment);
  });

  it('maps file resolveFileUrl', () => {
    const resolveFileUrl = vi.fn();
    const adapter: ExtensionsAdapter = {
      file: { uploadFile: async () => 'url', resolveFileUrl },
    };

    const options = mapExtensionsAdapterToOptions(adapter);
    expect(options.resolveFileUrl).toBe(resolveFileUrl);
  });

  it('maps file allowedMimeTypes', () => {
    const adapter: ExtensionsAdapter = {
      file: { uploadFile: async () => 'url', allowedMimeTypes: ['image/png', 'image/jpeg'] },
    };

    const options = mapExtensionsAdapterToOptions(adapter);
    expect(options.allowedMimeTypes).toEqual(['image/png', 'image/jpeg']);
  });

  it('maps file maxFileSize', () => {
    const adapter: ExtensionsAdapter = {
      file: { uploadFile: async () => 'url', maxFileSize: 5_000_000 },
    };

    const options = mapExtensionsAdapterToOptions(adapter);
    expect(options.maxFileSize).toBe(5_000_000);
  });
});
