import { Extension, type Extensions } from '@tiptap/core';
import { Editor } from '../components/Editor';
import { InteractiveViewer } from '../components/InteractiveViewer';
import type { EditorExtensionAccess } from '../editor-document';
import { useInkioEditor } from '../hooks/use-inkio-editor';
import { read, type InkioDocument, type InkioEditor, type InkioJSONContent } from '../index';

declare const extra: Extension & EditorExtensionAccess<{ readonly extra: string }>;
declare const defaults: Extensions;
declare const enabled: boolean;
const registered = [extra] as const;

// This fixture is typechecked, not executed.
export function useRegistrationTypes() {
  useInkioEditor({ extensions: [...defaults, extra] })?.extra.toUpperCase();
  useInkioEditor({ extensions: [extra, ...defaults] })?.extra.toUpperCase();
  useInkioEditor({ extensions: { items: [extra], replace: true } })?.extra.toUpperCase();
  const maybe = enabled ? registered : undefined;
  // @ts-expect-error A conditional registration need not have run.
  useInkioEditor({ extensions: maybe })?.extra;
  // @ts-expect-error A widened array can be empty.
  useInkioEditor({ extensions: [] as (typeof extra)[] })?.extra;
  // @ts-expect-error No registration by default.
  useInkioEditor()?.extra;
  return <>
    <Editor extensions={registered} onCreate={(editor) => editor.extra.toUpperCase()} />
    <Editor extensions={{ items: registered, replace: true }} onCreate={(editor) => editor.extra.toUpperCase()} />
    <InteractiveViewer content="" extensions={{ items: [extra] }} onCreate={(editor) => editor.extra.toUpperCase()} />
    <Editor extensions={[enabled ? extra : Extension.create({})]} onCreate={(editor) => {
      // @ts-expect-error The registered extension is not known here.
      editor.extra;
    }} />
  </>;
}

export function documentTypes(json: InkioJSONContent, editor: InkioEditor) {
  const documents: InkioDocument[] = [read(json), editor];
  for (const doc of documents) {
    doc.summary(doc.stats.chars).toUpperCase();
    // @ts-expect-error Document projections are read-only.
    doc.text = '';
    // @ts-expect-error Consumers cannot mutate shared cached values.
    doc.stats.words = 0;
    // @ts-expect-error References, including their entries, are immutable.
    doc.mentions[0]!.label = '';
    // @ts-expect-error The reference lists are read-only.
    doc.commentIds.push('id');
  }
  // @ts-expect-error Reading a saved document does not instantiate an editor.
  read(json).commands;
}
