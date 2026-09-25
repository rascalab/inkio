import {
  applyHljsTheme,
  isDarkTheme,
  releaseHljsTheme,
  removeHljsTheme,
  retainHljsTheme,
} from '../CodeBlock/hljs-theme';

describe('isDarkTheme', () => {
  it('detects .dark on the .inkio element itself (theme prop)', () => {
    document.body.innerHTML = '<div class="inkio dark"><div class="ProseMirror" id="ed"></div></div>';
    expect(isDarkTheme(document.getElementById('ed')!)).toBe(true);
  });

  it('detects an ancestor .dark (e.g. next-themes on <html>)', () => {
    document.body.innerHTML =
      '<div class="dark"><div class="inkio"><div class="ProseMirror" id="ed"></div></div></div>';
    expect(isDarkTheme(document.getElementById('ed')!)).toBe(true);
  });

  it('respects an explicit .light override under a dark ancestor', () => {
    document.body.innerHTML =
      '<div class="dark"><div class="inkio light"><div class="ProseMirror" id="ed"></div></div></div>';
    expect(isDarkTheme(document.getElementById('ed')!)).toBe(false);
  });

  it('defaults to light without any dark marker', () => {
    document.body.innerHTML = '<div class="inkio"><div class="ProseMirror" id="ed"></div></div>';
    expect(isDarkTheme(document.getElementById('ed')!)).toBe(false);
  });
});

describe('applyHljsTheme', () => {
  afterEach(() => {
    removeHljsTheme();
  });

  it('writes the dark theme and repairs a missing tag', () => {
    applyHljsTheme(true);
    const el = document.getElementById('inkio-hljs-theme');
    expect(el?.textContent).toContain('#ff7b72');

    // Simulate HMR wiping the tag: re-apply must restore it.
    el?.remove();
    applyHljsTheme(true);
    expect(document.getElementById('inkio-hljs-theme')?.textContent).toContain('#ff7b72');
  });

  it('switches back to the light theme', () => {
    applyHljsTheme(true);
    applyHljsTheme(false);
    expect(document.getElementById('inkio-hljs-theme')?.textContent).toContain('#d73a49');
  });
});

describe('hljs theme refcount', () => {
  afterEach(() => {
    removeHljsTheme();
  });

  it('keeps the shared tag while any editor remains', () => {
    applyHljsTheme(false);
    retainHljsTheme();
    retainHljsTheme();
    releaseHljsTheme();
    expect(document.getElementById('inkio-hljs-theme')).not.toBeNull();
    releaseHljsTheme();
    expect(document.getElementById('inkio-hljs-theme')).toBeNull();
  });

  it('never drops below zero on unbalanced release', () => {
    applyHljsTheme(false);
    releaseHljsTheme();
    releaseHljsTheme();
    expect(document.getElementById('inkio-hljs-theme')).toBeNull();
    retainHljsTheme();
    releaseHljsTheme();
    expect(document.getElementById('inkio-hljs-theme')).toBeNull();
  });
});
