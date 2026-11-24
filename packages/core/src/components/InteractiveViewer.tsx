'use client';

import { useMemo, useState } from 'react';
import type { Extensions, JSONContent } from '@tiptap/core';
import type { InkioMessageOverrides } from '../i18n/messages';
import type { WithEditorExtensions } from '../editor-document';
import { getInteractiveExtensions } from '../extensions/interactive-extensions';
import { useReadOnlyContentSync } from '../hooks/use-read-only-content-sync';
import { resolveExtensionsInput, type ExtensionsInput } from '../utils/extensions-input';
import { useStableProps } from '../utils/stable-options';
import type { EditorProps } from './Editor';
import { EditorContainer, useEditorSurface } from './editor-surface';

export type InteractiveViewerProps = Pick<EditorProps, 'locale' | 'theme' | 'onCreate'> & {
  content: string | JSONContent;
  ui?: Pick<EditorProps, 'className' | 'style' | 'bordered' | 'icons'> & { messages?: InkioMessageOverrides };
  extensions?: ExtensionsInput;
};

type Props = InteractiveViewerProps & { presetExtensions?: Extensions };

/** Live preset viewer: same document surface as Editor, without its editing chrome. */
export function InteractiveViewer<const Input extends Props['extensions']>(props: WithEditorExtensions<Props, Input>): React.JSX.Element;
export function InteractiveViewer(props: Props): React.JSX.Element;
export function InteractiveViewer({ content, locale, theme, ui, extensions, onCreate, presetExtensions }: Props) {
  const stableUi = useStableProps(ui ?? {});
  const [defaults] = useState(() => getInteractiveExtensions({ locale, messages: stableUi.messages, icons: stableUi.icons }));
  const resolved = useMemo(() => resolveExtensionsInput(extensions, presetExtensions ? [...defaults, ...presetExtensions] : defaults), [defaults, presetExtensions, extensions]);
  const { editor, body } = useEditorSurface({ content, locale, messages: stableUi.messages, icons: stableUi.icons, editable: false, onCreate }, resolved);
  useReadOnlyContentSync(editor, content);
  return <EditorContainer theme={theme} {...stableUi}>{body}</EditorContainer>;
}
