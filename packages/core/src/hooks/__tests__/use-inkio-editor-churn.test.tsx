import { render } from '@testing-library/react';
import { useMemo } from 'react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { useInkioEditor } from '../use-inkio-editor';

function Harness({ burst }: { burst: boolean }) {
  // Intentionally unstable when `burst` is true: a fresh array identity per
  // render, mimicking inline extension props.
  const extensions = useMemo(() => [Document, Paragraph, Text], []);
  const unstable = burst ? [...extensions] : extensions;
  const editor = useInkioEditor({ initialContent: '<p>hi</p>', extensions: unstable });
  return <div data-ready={editor ? 'yes' : 'no'} />;
}

describe('useInkioEditor extensions churn warning', () => {
  it('warns once (dev) when extensions identity changes across renders', async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message: string) => {
      warnings.push(message);
    };
    try {
      const { rerender } = render(<Harness burst={false} />);
      expect(warnings.filter((message) => message.includes('[inkio]'))).toHaveLength(0);

      rerender(<Harness burst />);
      rerender(<Harness burst />);
      expect(warnings.filter((message) => message.includes('[inkio]'))).toHaveLength(1);
    } finally {
      console.warn = originalWarn;
    }
  });
});
