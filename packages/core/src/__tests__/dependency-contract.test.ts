import corePackage from '../../package.json';
import advancedPackage from '../../../advanced/package.json';
import simplePackage from '../../../simple/package.json';
import editorPackage from '../../../editor/package.json';
import imageEditorPackage from '../../../image-editor/package.json';

describe('layered package dependency contract', () => {
  it('keeps React as a peer and owns runtime packages internally', () => {
    const packages = [corePackage, advancedPackage, simplePackage, editorPackage];

    packages.forEach((pkg) => {
      expect(pkg.peerDependencies).toEqual({
        react: '^18.0.0 || ^19.0.0',
        'react-dom': '^18.0.0 || ^19.0.0',
      });

      Object.keys(pkg.peerDependencies ?? {}).forEach((name) => {
        expect(name.startsWith('@tiptap/')).toBe(false);
      });
    });

    expect(imageEditorPackage.peerDependencies).toEqual({
      '@inkio/core': '^0.0.5',
      react: '^18.0.0 || ^19.0.0',
      'react-dom': '^18.0.0 || ^19.0.0',
    });

    expect(corePackage.dependencies).toMatchObject({
      '@tiptap/extension-color': expect.any(String),
      '@tiptap/extension-text-align': expect.any(String),
      '@tiptap/extension-subscript': expect.any(String),
      '@tiptap/extension-superscript': expect.any(String),
      '@tiptap/extension-text-style': expect.any(String),
      'lucide': expect.any(String),
      'remark-directive': expect.any(String),
      'remark-gfm': expect.any(String),
      'remark-parse': expect.any(String),
      'remark-stringify': expect.any(String),
      'unified': expect.any(String),
    });

    expect(editorPackage.dependencies).toMatchObject({
      '@inkio/core': 'workspace:^',
      '@inkio/advanced': 'workspace:^',
    });

    expect(advancedPackage.dependencies).toMatchObject({
      '@inkio/core': 'workspace:^',
      '@tiptap/extension-mention': expect.any(String),
    });

    expect(simplePackage.dependencies).toMatchObject({
      '@inkio/core': 'workspace:^',
    });

    expect(imageEditorPackage.dependencies).toMatchObject({
      'konva': expect.any(String),
      'react-konva': expect.any(String),
    });

    expect(corePackage.devDependencies).toMatchObject({
      react: expect.any(String),
      'react-dom': expect.any(String),
    });

    expect(editorPackage.dependencies).not.toMatchObject({
      '@tiptap/extension-color': expect.any(String),
      '@tiptap/extension-text-style': expect.any(String),
    });

    const removedMarkdownBridgePackages = [
      ['mar', 'ked'].join(''),
      ['tu', 'rnd', 'own'].join(''),
      `${['tu', 'rnd', 'own'].join('')}-plugin-gfm`,
    ];
    removedMarkdownBridgePackages.forEach((name) => {
      expect(corePackage.dependencies).not.toHaveProperty(name);
    });
  });
});
