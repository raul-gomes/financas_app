import { describe, expect, it } from 'vitest';
import { escapeHtml } from './format';

describe('escapeHtml', () => {
  it('neutraliza marcação vinda de nomes de categoria', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapa aspas e e-comercial', () => {
    expect(escapeHtml(`Tom & "Jerry's"`)).toBe('Tom &amp; &quot;Jerry&#39;s&quot;');
  });

  it('trata nulos como texto vazio', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
