import { Node, mergeAttributes, InputRule, PasteRule } from '@tiptap/core';
import { isSafeUrl } from '@inkio/core';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, any>;
  /**
   * 위키링크 클릭 시 호출되는 콜백
   * @param href - 링크 대상 (페이지 이름)
   */
  onClick?: (href: string) => void;
}

// WikiLink 패턴 정규식
// PasteRule은 /g 정규식의 lastIndex 상태를 공유하므로, 매 호출마다 새 인스턴스를
// 생성하기 위해 소스 문자열로 보관한다.
const WIKI_LINK_PATTERN = '\\[\\[([^\\]]+)\\]\\]';
const WIKI_LINK_INPUT_REGEX = /\[\[([^\]]+)\]\]$/;

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onClick: undefined,
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-href') ?? element.textContent ?? '';
          const href = raw.trim();
          if (!href) return null;
          // Reject javascript:/data:/vbscript: payloads pasted as HTML.
          if (!isSafeUrl(href)) return null;
          return href;
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return {};
          const raw = element.getAttribute('data-href') ?? element.textContent ?? '';
          const href = raw.trim();
          // Block active-content targets at parse time.
          if (href && !isSafeUrl(href)) return false;
          return href ? { href } : {};
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { href, ...rest } = HTMLAttributes;
    const rawHref = typeof href === 'string' ? href : '';
    // Never render an unsafe href, even if it bypassed create/parse guards.
    // Drop it from both the attribute and the text output.
    const safeAttrs = rawHref && isSafeUrl(rawHref) ? { href: rawHref } : {};
    const safeText = rawHref && isSafeUrl(rawHref) ? rawHref : '';
    return ['span', mergeAttributes(this.options.HTMLAttributes, rest, safeAttrs, { 'data-wiki-link': '' }), safeText];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement('span');
      let currentHref = String(node.attrs.href ?? '').trim();

      // 기본 속성 적용
      Object.entries(mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-wiki-link': '' })).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          dom.setAttribute(key, String(value));
        }
      });

      // 커서 스타일만 동적으로 적용 (나머지는 CSS에서 처리)
      dom.style.cursor = this.options.onClick ? 'pointer' : 'default';

      // 텍스트 설정
      dom.textContent = currentHref;

      // 클릭 이벤트 핸들러
      const clickHandler = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        if (currentHref.length > 0 && isSafeUrl(currentHref)) {
          this.options.onClick?.(currentHref);
        }
      };

      if (this.options.onClick) {
        dom.addEventListener('click', clickHandler);
      }

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'wikiLink') return false;
          currentHref = String(updatedNode.attrs.href ?? '').trim();
          dom.textContent = currentHref;
          return true;
        },
        destroy() {
          dom.removeEventListener('click', clickHandler);
        },
      };
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: WIKI_LINK_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;
          const text = (match[1] ?? '').trim();
          if (!text) return;
          // Reject javascript:/data:/vbscript: targets typed by the user.
          if (!isSafeUrl(text)) return;

          tr.replaceWith(start, end, this.type.create({ href: text }));
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: new RegExp(WIKI_LINK_PATTERN, 'g'),
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;
          const text = (match[1] ?? '').trim();
          if (!text) return;
          // Reject javascript:/data:/vbscript: targets from pasted content.
          if (!isSafeUrl(text)) return;

          tr.replaceWith(start, end, this.type.create({ href: text }));
        },
      }),
    ];
  },
});
