import { ImageBlock } from '@inkio/core';

describe('ImageBlock extension', () => {
  it('should not include image/svg+xml in default allowedMimeTypes', () => {
    const extension = ImageBlock.configure({});
    const options = (extension as any).options;
    expect(options.allowedMimeTypes).not.toContain('image/svg+xml');
  });

  it('should include standard safe image MIME types', () => {
    const extension = ImageBlock.configure({});
    const options = (extension as any).options;
    expect(options.allowedMimeTypes).toContain('image/jpeg');
    expect(options.allowedMimeTypes).toContain('image/png');
    expect(options.allowedMimeTypes).toContain('image/gif');
    expect(options.allowedMimeTypes).toContain('image/webp');
  });

  it('should allow consumers to opt-in to SVG via configuration', () => {
    const extension = ImageBlock.configure({
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml'],
    });
    const options = (extension as any).options;
    expect(options.allowedMimeTypes).toContain('image/svg+xml');
  });
});
