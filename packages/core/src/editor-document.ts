import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { getHeadingsFromDoc } from './headings/headings';
import { documentView, type DocumentCache, type InkioDocument } from './read-document';
import { editorPlainText } from './serialization';

declare const extensionAccess: unique symbol;

/** A type-only declaration of the members an extension installs on its editor. */
export type EditorExtensionAccess<Access> = { readonly [extensionAccess]: Access };

type AccessOf<Extension> = Extension extends EditorExtensionAccess<infer Access> ? Access : unknown;

// Only required tuple positions prove registration. Inspect both ends so a
// spread of unknown defaults doesn't hide a known extension after it.
type RegisteredAccess<List> =
  List extends readonly [infer First, ...infer Rest] ? AccessOf<First> & RegisteredAccess<Rest> :
  List extends readonly [...infer Rest, infer Last] ? RegisteredAccess<Rest> & AccessOf<Last> :
  unknown;

export type RegisteredEditor<Input> = InkioEditor & RegisteredAccess<
  Input extends { items: infer Items } ? Items : Input
>;

/** A present extensions prop is the source of truth for the callback's instance type. */
export type WithEditorExtensions<Props, Input> = Omit<Props, 'extensions' | 'onCreate' | 'onChange'> & (
  'onChange' extends keyof Props ? { onChange?: (editor: RegisteredEditor<Input>) => void } : unknown
) & {
  extensions: Input;
  onCreate?: (editor: RegisteredEditor<Input>) => void;
};

export type InkioEditor = Editor & InkioDocument;

const documentAccess = Symbol.for('@inkio/core/document-access');

/** Add lazy document access to this editor, without modifying Tiptap's prototype. */
export function withDocumentAccess(editor: Editor): InkioEditor {
  if (!Object.prototype.hasOwnProperty.call(editor, documentAccess)) {
    let cache: DocumentCache<ProseMirrorNode> | undefined;
    function current(): DocumentCache<ProseMirrorNode> {
      const doc = editor.state.doc;
      if (cache?.doc !== doc) cache = { doc };
      return cache;
    }
    const view = documentView(current, editorPlainText, getHeadingsFromDoc);
    const descriptors = Object.getOwnPropertyDescriptors(Object.freeze(view));
    // Check all names before installing any; keep getters off editor enumeration.
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key in editor) throw new TypeError(`Cannot install Inkio document access: editor.${key} already exists.`);
      descriptor.enumerable = false;
    }
    Object.defineProperties(editor, { ...descriptors, [documentAccess]: { value: true } });
  }
  return editor as InkioEditor;
}
