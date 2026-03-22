import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToC, calcTocTop } from '../TableOfContents';
import type { JSONContent } from '@tiptap/core';

// jsdom doesn't have IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
vi.stubGlobal('IntersectionObserver', vi.fn(function () {
  return { observe: mockObserve, disconnect: mockDisconnect, unobserve: vi.fn() };
}));

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();
});

const DOC_WITH_HEADINGS: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section A' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Subsection' }] },
    { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Deep' }] },
  ],
};

function createMockDoc(json: JSONContent) {
  const nodes = (json.content ?? []).map((node) => ({
    type: { name: node.type },
    attrs: node.attrs ?? {},
    textContent: node.content?.map((c: any) => c.text ?? '').join('') ?? '',
  }));
  return {
    forEach: (fn: (node: any) => void) => nodes.forEach(fn),
  };
}

function createMockSource(doc: JSONContent) {
  const listeners = new Map<string, Set<Function>>();
  const container = document.createElement('div');
  container.innerHTML = '<h1>Title</h1><p>body</p><h2>Section A</h2><h3>Subsection</h3><h4>Deep</h4>';
  // jsdom headings lack scrollIntoView
  container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((el) => {
    (el as any).scrollIntoView = vi.fn();
  });

  let currentDoc = doc;
  return {
    getJSON: vi.fn(() => currentDoc),
    state: { get doc() { return createMockDoc(currentDoc); } },
    _setDoc(next: JSONContent) { currentDoc = next; },
    on: vi.fn((event: string, fn: Function) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    }),
    off: vi.fn((event: string, fn: Function) => {
      listeners.get(event)?.delete(fn);
    }),
    view: {
      dom: container,
    },
    _emit(event: string, payload: unknown) {
      listeners.get(event)?.forEach((fn) => fn(payload));
    },
  } as any;
}

describe('ToC component', () => {
  it('renders nothing when source is null', () => {
    const { container } = render(<ToC source={null} />);
    expect(container.querySelector('.inkio-toc')).toBeNull();
  });

  it('renders nothing when source has no headings', () => {
    const emptyDoc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    };
    const source = createMockSource(emptyDoc);
    const { container } = render(<ToC source={source} />);
    expect(container.querySelector('.inkio-toc')).toBeNull();
  });

  it('renders minimap bars and panel links for headings', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} />);

    // Default maxLevel=3, so h4 "Deep" should be excluded
    const nav = screen.getByLabelText('Table of contents');
    expect(nav).toBeInTheDocument();

    const bars = nav.querySelectorAll('.inkio-toc-bar');
    expect(bars).toHaveLength(3); // h1, h2, h3

    const links = nav.querySelectorAll('.inkio-toc-link');
    expect(links).toHaveLength(3);
    expect(links[0].textContent).toBe('Title');
    expect(links[1].textContent).toBe('Section A');
    expect(links[2].textContent).toBe('Subsection');
  });

  it('respects maxLevel prop', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} maxLevel={2} />);

    const nav = screen.getByLabelText('Table of contents');
    const links = nav.querySelectorAll('.inkio-toc-link');
    expect(links).toHaveLength(2); // h1, h2 only
  });

  it('includes all levels when maxLevel is high', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} maxLevel={6} />);

    const nav = screen.getByLabelText('Table of contents');
    const links = nav.querySelectorAll('.inkio-toc-link');
    expect(links).toHaveLength(4); // h1, h2, h3, h4
  });

  it('applies custom className', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} className="my-toc" />);

    const nav = screen.getByLabelText('Table of contents');
    expect(nav.className).toContain('inkio-toc');
    expect(nav.className).toContain('my-toc');
  });

  it('first bar is active by default', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} />);

    const bars = document.querySelectorAll('.inkio-toc-bar');
    expect(bars[0].classList.contains('is-active')).toBe(true);
    expect(bars[1].classList.contains('is-active')).toBe(false);
  });

  it('sets active index on link click', async () => {
    const user = userEvent.setup();
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} />);

    const links = document.querySelectorAll('.inkio-toc-link');
    await user.click(links[1]); // click "Section A"

    await waitFor(() => {
      const bars = document.querySelectorAll('.inkio-toc-bar');
      expect(bars[1].classList.contains('is-active')).toBe(true);
    });

    const items = document.querySelectorAll('.inkio-toc-item');
    expect(items[1].classList.contains('is-active')).toBe(true);
  });

  it('updates headings when source emits update with docChanged', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    const { rerender } = render(<ToC source={source} />);

    expect(document.querySelectorAll('.inkio-toc-link')).toHaveLength(3);

    // Simulate doc change — source now returns fewer headings
    const updatedDoc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Only One' }] },
      ],
    };
    source._setDoc(updatedDoc);
    source._emit('update', { transaction: { docChanged: true } });

    rerender(<ToC source={source} />);
    expect(document.querySelectorAll('.inkio-toc-link')).toHaveLength(1);
    expect(document.querySelector('.inkio-toc-link')!.textContent).toBe('Only One');
  });

  it('skips update when transaction.docChanged is false', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} />);

    const docForEach = vi.spyOn(source.state.doc, 'forEach');
    source._emit('update', { transaction: { docChanged: false } });
    // doc should not have been traversed again
    expect(docForEach).not.toHaveBeenCalled();
    docForEach.mockRestore();
  });

  it('bar widths decrease with heading depth', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} maxLevel={4} />);

    const bars = document.querySelectorAll('.inkio-toc-bar') as NodeListOf<HTMLElement>;
    const widths = Array.from(bars).map((b) => parseFloat(b.style.width));
    // Each deeper level should have equal or smaller width
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
    }
  });

  it('link href matches heading id', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    render(<ToC source={source} />);

    const links = document.querySelectorAll('.inkio-toc-link') as NodeListOf<HTMLAnchorElement>;
    expect(links[0].getAttribute('href')).toBe('#title');
    expect(links[1].getAttribute('href')).toBe('#section-a');
    expect(links[2].getAttribute('href')).toBe('#subsection');
  });

  it('cleans up listeners on unmount', () => {
    const source = createMockSource(DOC_WITH_HEADINGS);
    const { unmount } = render(<ToC source={source} />);

    expect(source.on).toHaveBeenCalledWith('update', expect.any(Function));
    unmount();
    expect(source.off).toHaveBeenCalledWith('update', expect.any(Function));
  });
});

// MARGIN = 48 (hardcoded in TableOfContents.tsx)
const MARGIN = 48;

describe('calcTocTop (scroll tracking)', () => {
  it('pins to MARGIN when editor top is below viewport anchor', () => {
    expect(calcTocTop(100, 1000, 200, 0)).toBe(MARGIN);
  });

  it('pins to MARGIN when editor top exactly equals viewport anchor', () => {
    expect(calcTocTop(48, 1000, 200, 0)).toBe(MARGIN);
  });

  it('floats with viewport when scrolled past editor top', () => {
    expect(calcTocTop(-200, 800, 100, 0)).toBe(248);
  });

  it('floats with viewport respecting scrollOffset', () => {
    expect(calcTocTop(-100, 900, 100, 60)).toBe(208);
  });

  it('pins to editor bottom when editor bottom is close to viewport top', () => {
    expect(calcTocTop(-900, 100, 150, 0)).toBe(802);
  });

  it('pins to MARGIN minimum when editor is very short', () => {
    expect(calcTocTop(-50, 10, 200, 0)).toBe(MARGIN);
  });

  it('transitions correctly across all three states', () => {
    const navHeight = 100;
    expect(calcTocTop(50, 1050, navHeight, 0)).toBe(MARGIN);
    expect(calcTocTop(-300, 700, navHeight, 0)).toBe(348);
    expect(calcTocTop(-880, 120, navHeight, 0)).toBe(852);
  });
});
