import { isDarkTheme } from '../CodeBlock/hljs-theme';

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
