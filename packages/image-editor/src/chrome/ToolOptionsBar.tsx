import type { ReactNode } from 'react';
import type { ControlPanel, ViewportKind } from '../utils/controls-model';
import { ToolOptionsPanel } from '../toolbar/ToolOptionsPanel';

type ToolOptionsBarProps = { readonly viewportKind: ViewportKind } & (
  | { readonly panel: ControlPanel; readonly children?: never }
  | { readonly panel?: never; readonly children: ReactNode }
);

export function ToolOptionsBar({ children, panel, viewportKind }: ToolOptionsBarProps) {
  return (
    <div
      className="inkio-ie-options-bar"
      data-viewport-kind={viewportKind}
      data-testid={viewportKind === 'desktop' ? 'inkio-ie-util-panel' : 'inkio-ie-mobile-option-strip'}
    >
      {panel ? <ToolOptionsPanel panel={panel} viewportKind={viewportKind} /> : children}
    </div>
  );
}
