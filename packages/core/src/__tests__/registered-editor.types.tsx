import { Extension, type Extensions } from '@tiptap/core';
import { Editor } from '../components/Editor';
import { InteractiveViewer } from '../components/InteractiveViewer';
import type { EditorExtensionAccess } from '../editor-document';
import { useInkioEditor } from '../hooks/use-inkio-editor';
import { read, withDocumentAccess, type InkioDocument, type InkioEditor, type InkioJSONContent } from '../index';
import { Markdown, MarkdownPaste } from '../markdown';

declare const extra: Extension & EditorExtensionAccess<{ readonly extra: string }>;
declare const defaults: Extensions;
declare const enabled: boolean;
const registered = [extra] as const;

// This fixture is typechecked, not executed.
export function useRegistrationTypes() {
  useInkioEditor({ extensions: [...defaults, extra] })?.extra.toUpperCase();
  // @ts-expect-error A later default with an unknown name could replace extra.
  useInkioEditor({ extensions: [extra, ...defaults] })?.extra;
  useInkioEditor({ extensions: { items: [extra, ...defaults], replace: true } })?.extra.toUpperCase();
  useInkioEditor({ extensions: { items: [extra], replace: true } })?.extra.toUpperCase();
  const maybe = enabled ? registered : undefined;
  // @ts-expect-error A conditional registration need not have run.
  useInkioEditor({ extensions: maybe })?.extra;
  // @ts-expect-error A widened array can be empty.
  useInkioEditor({ extensions: [] as (typeof extra)[] })?.extra;
  // @ts-expect-error No registration by default.
  useInkioEditor()?.extra;
  const configured = Markdown.configure({}).extend({}).configure({});
  const withMarkdown = useInkioEditor({ extensions: [configured, MarkdownPaste] });
  if (withMarkdown) {
    withMarkdown.markdown = '# New';
    withDocumentAccess(withMarkdown).markdown = 'still registered';
    // @ts-expect-error The extension exposes only the markdown property.
    withMarkdown.setMarkdown;
    // @ts-expect-error Markdown assignments require source text.
    withMarkdown.markdown = 10;
  }
  const replacement = Extension.create({ name: 'inkioMarkdown' });
  // @ts-expect-error The later unbranded extension can replace Markdown by name.
  useInkioEditor({ extensions: [Markdown, replacement] })?.markdown;
  useInkioEditor({ extensions: [replacement, Markdown] })?.markdown.toUpperCase();
  const overridden = Markdown.extend({ onBeforeCreate() {} });
  // @ts-expect-error This extension replaced the hook that installs Markdown.
  useInkioEditor({ extensions: [overridden] })?.markdown;
  return <>
    <Editor extensions={registered} onCreate={(editor) => editor.extra.toUpperCase()} />
    <Editor extensions={{ items: registered, replace: true }} onCreate={(editor) => editor.extra.toUpperCase()} />
    <InteractiveViewer content="" extensions={{ items: [extra] }} onCreate={(editor) => editor.extra.toUpperCase()} />
    <Editor extensions={[configured]} onCreate={(editor) => { editor.markdown = 'assigned'; }}
      onChange={(editor) => editor.markdown.toUpperCase()} />
    <Editor extensions={[Markdown, replacement]} onChange={(editor) => {
      // @ts-expect-error A change callback also sees only the effective extensions.
      editor.markdown;
    }} />
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
