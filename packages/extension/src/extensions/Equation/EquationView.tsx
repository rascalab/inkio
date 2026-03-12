import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';

interface EquationViewProps extends NodeViewProps {
  displayMode: boolean;
}

interface KatexModule {
  render: (
    latex: string,
    element: HTMLElement,
    options?: {
      displayMode?: boolean;
      throwOnError?: boolean;
    }
  ) => void;
}

const resolveKatexModule = (katexImport: unknown): KatexModule => {
  if (katexImport && typeof katexImport === 'object' && 'render' in katexImport) {
    return katexImport as KatexModule;
  }

  if (
    katexImport &&
    typeof katexImport === 'object' &&
    'default' in katexImport &&
    typeof (katexImport as { default?: unknown }).default === 'object' &&
    (katexImport as { default?: object }).default !== null &&
    'render' in (katexImport as { default: object }).default
  ) {
    return (katexImport as { default: KatexModule }).default;
  }

  throw new Error('KaTeX module does not expose render.');
};

export const EquationView = ({ node, displayMode }: EquationViewProps) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [hasError, setHasError] = useState(false);
  const latex = String(node.attrs.latex || '');

  useEffect(() => {
    if (!latex) {
      if (containerRef.current) {
        containerRef.current.textContent = '';
      }
      setHasError(false);
      return;
    }

    let cancelled = false;

    import('katex')
      .then((katexImport) => {
        if (cancelled) {
          return;
        }

        const katex = resolveKatexModule(katexImport);

        if (containerRef.current) {
          try {
            katex.render(latex, containerRef.current, {
              displayMode,
              throwOnError: false,
              trust: false,
              strict: 'warn',
              maxSize: 500,
              maxExpand: 1000,
            } as Parameters<typeof katex.render>[2]);
            setHasError(false);
          } catch {
            containerRef.current.textContent = latex;
            setHasError(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [latex, displayMode]);

  const fallbackText = displayMode ? `$$${latex}$$` : `$${latex}$`;

  return (
    <NodeViewWrapper
      as={displayMode ? 'div' : 'span'}
      className={displayMode ? 'inkio-equation-block' : 'inkio-equation-inline'}
    >
      {hasError ? (
        <code className="inkio-equation-fallback">{fallbackText}</code>
      ) : (
        <span ref={containerRef} />
      )}
    </NodeViewWrapper>
  );
};

export const EquationBlockView = (props: NodeViewProps) => {
  return <EquationView {...props} displayMode />;
};

export const EquationInlineView = (props: NodeViewProps) => {
  return <EquationView {...props} displayMode={false} />;
};
