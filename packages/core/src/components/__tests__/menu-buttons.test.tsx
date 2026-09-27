import { buttonRefSetter, resolveActionLabel, rovingTabIndex } from '../menu-buttons';
import type { InkioToolbarAction } from '../toolbar-actions';

const base: InkioToolbarAction = {
  id: 'bold',
  iconId: 'bold',
  surfaces: ['toolbar'],
  group: 'marks',
  run: () => {},
};

describe('menu-buttons helpers', () => {
  it('resolves labels: explicit → localized → id', () => {
    const messages = { actions: { bold: 'Bold!' } } as any;
    expect(resolveActionLabel({ ...base, label: 'Custom' }, messages)).toBe('Custom');
    expect(resolveActionLabel({ ...base, labelKey: 'bold' }, messages)).toBe('Bold!');
    expect(resolveActionLabel({ ...base, id: 'custom-id' }, messages)).toBe('custom-id');
  });

  it('computes roving tabindex', () => {
    expect(rovingTabIndex(0, -1)).toBe(0);
    expect(rovingTabIndex(1, -1)).toBe(-1);
    expect(rovingTabIndex(2, 2)).toBe(0);
    expect(rovingTabIndex(0, 2)).toBe(-1);
  });

  it('keeps the ref map in sync', () => {
    const refs = new Map<number, HTMLButtonElement>();
    const el = document.createElement('button');
    buttonRefSetter(refs, 3)(el);
    expect(refs.get(3)).toBe(el);
    buttonRefSetter(refs, 3)(null);
    expect(refs.has(3)).toBe(false);
  });
});
