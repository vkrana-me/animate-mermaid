import { describe, expect, it } from 'vitest';
import { THEMES, mix, resolveTheme, themeConfig } from '../src/theme';

describe('theme', () => {
  it('mixes hex colors', () => {
    expect(mix('#000000', '#ffffff', 50)).toBe('#808080');
    expect(mix('#fff', '#000', 100)).toBe('#ffffff');
    expect(mix('red', '#000', 50)).toBe('red');
  });

  it('derives missing slots from bg/fg', () => {
    const t = resolveTheme({ bg: '#ffffff', fg: '#27272a' });
    expect(t.line).toBe(mix('#27272a', '#ffffff', 50));
    expect(t.accent).toBe(mix('#27272a', '#ffffff', 85));
    expect(resolveTheme('tokyo-night-light').surface).toBe(mix('#343b58', '#d5d6db', 6));
  });

  it('keeps explicit slots', () => {
    expect(resolveTheme('nord').accent).toBe('#88c0d0');
    expect(resolveTheme({ bg: '#000', fg: '#fff', accent: '#f00' }).accent).toBe('#f00');
  });

  it('throws on an unknown name', () => {
    expect(() => resolveTheme('nope' as never)).toThrow(/unknown theme/);
  });

  it('builds a base Mermaid config for every built-in theme', () => {
    for (const name of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
      const c = themeConfig(name);
      expect(c.theme).toBe('base');
      expect(c.themeVariables?.background).toBe(THEMES[name].bg);
      expect(c.themeCSS).toContain(resolveTheme(name).accent);
    }
    expect(themeConfig('dracula').themeVariables?.darkMode).toBe(true);
    expect(themeConfig('github-light').themeVariables?.darkMode).toBe(false);
  });
});
