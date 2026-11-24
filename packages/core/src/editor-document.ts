import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { documentView, type DocumentCache, type InkioDocument } from './read-document';

declare const extensionAccess: unique symbol;

/** A type-only declaration of the members an extension installs on its editor. */
export type EditorExtensionAccess<Access> = { readonly [extensionAccess]: Access };

type NameOf<E> = E extends { name: infer Name extends string } ? Name : never;
type AccessOf<E, Shadowed> = E extends EditorExtensionAccess<infer Access>
  ? [NameOf<E> & Shadowed] extends [never] ? Access : unknown
  : unknown;

// Only required tuple positions prove registration. Additive lists are merged
// last-by-name; a later wide extension name (including a spread) can shadow
// any earlier one. Exact lists bypass that merge.
type RegisteredAccess<List, Merge extends boolean, Later = never> =
  List extends readonly [...infer Rest, infer Last]
    ? AccessOf<Last, Later> & RegisteredAccess<Rest, Merge, Later | (Merge extends true ? NameOf<Last> : never)>
    : List extends readonly [infer First, ...infer Rest]
      ? AccessOf<First, Later | (Merge extends true ? NameOf<Rest[number]> : never)> & RegisteredAccess<Rest, Merge, Later>
      : unknown;

export type RegisteredEditor<Input, Reserved extends string = never> = InkioEditor & (
  Input extends { items: infer Items; replace: true } ? RegisteredAccess<Items, false, Reserved> :
  Input extends { items: infer Items } ? RegisteredAccess<Items, true, Reserved> :
  RegisteredAccess<Input, true, Reserved>
);

/** A present extensions prop is the source of truth for the callback's instance type. */
export type WithEditorExtensions<Props, Input, Reserved extends string = never> = Omit<Props, 'extensions' | 'onCreate' | 'onChange'> & (
  'onChange' extends keyof Props ? { onChange?: (editor: RegisteredEditor<Input, Reserved>) => void } : unknown
) & {
  extensions: Input;
  onCreate?: (editor: RegisteredEditor<Input, Reserved>) => void;
};

export type InkioEditor = Editor & InkioDocument;

const documentAccess = Symbol.for('@inkio/core/document-access');

/** Add lazy document access to this editor, without modifying Tiptap's prototype. */
export function withDocumentAccess<T extends Editor>(editor: T): T & InkioDocument {
  if (!Object.prototype.hasOwnProperty.call(editor, documentAccess)) {
    let cache: DocumentCache<ProseMirrorNode> | undefined;
    function current(): DocumentCache<ProseMirrorNode> {
      const doc = editor.state.doc;
      if (cache?.doc !== doc) cache = { doc };
      return cache;
    }
    const view = documentView(current);
    const descriptors = Object.getOwnPropertyDescriptors(Object.freeze(view));
    // Check all names before installing any; keep getters off editor enumeration.
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key in editor) throw new TypeError(`Cannot install Inkio document access: editor.${key} already exists.`);
      descriptor.enumerable = false;
    }
    Object.defineProperties(editor, { ...descriptors, [documentAccess]: { value: true } });
  }
  return editor as T & InkioDocument;
}
