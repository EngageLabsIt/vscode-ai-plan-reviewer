import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import type { Section } from '../../shared/models';

export interface RenderOutput {
  html: string;
}

export class PlanMarkdownEngine {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
          } catch { /* fall through */ }
        }
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    });

    this._addBlockIdRenderer();
  }

  public render(content: string, sections: Section[]): RenderOutput {
    const rawHtml = this.md.render(content);
    const html = this._applySectionWrappers(rawHtml, sections);
    return { html };
  }

  private _addBlockIdRenderer(): void {
    // Target token types that represent block-level elements
    const blockTokens = [
      'paragraph_open',
      'heading_open',
      'blockquote_open',
      'list_item_open',
      'code_block',
      'fence',
    ];

    for (const ruleName of blockTokens) {
      const original = this.md.renderer.rules[ruleName];
      this.md.renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.map && token.map.length >= 2) {
          token.attrSet('data-line', String(token.map[0] + 1));
          token.attrSet('data-line-end', String(token.map[1]));
          token.attrJoin('class', 'annotatable-block');
        }
        if (original) {
          return original(tokens, idx, options, env, self);
        }
        return self.renderToken(tokens, idx, options);
      };
    }
  }

  private _applySectionWrappers(html: string, sections: Section[]): string {
    if (sections.length === 0) return html;

    const sorted = [...sections].sort((a, b) => a.startLine - b.startLine);

    // Find insertion points: for each section, find the char index of its heading tag
    type Marker = { pos: number; tag: string };
    const markers: Marker[] = [];

    for (const sec of sorted) {
      // Match <h1, <h2, etc. with data-line="N"
      const re = new RegExp(`<h${sec.level}[^>]*data-line="${sec.startLine}"[^>]*>`);
      const m = re.exec(html);
      if (m === null) continue;
      markers.push({ pos: m.index, tag: `<section data-section-id="${sec.id}" data-level="${sec.level}">` });
    }

    // Sort markers by position
    markers.sort((a, b) => a.pos - b.pos);

    // Build result by inserting <section> before each heading
    let result = '';
    let lastPos = 0;

    for (let i = 0; i < markers.length; i++) {
      const { pos, tag } = markers[i];
      result += html.slice(lastPos, pos);
      result += tag;
      lastPos = pos;
    }
    result += html.slice(lastPos);

    // Now close sections: insert </section> before each subsequent <section> opener and at end
    const sectionOpenRe = /<section data-section-id="[^"]+"/g;
    const opens: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = sectionOpenRe.exec(result)) !== null) {
      opens.push(m.index);
    }

    // Insert </section> before each <section> opener (except the first) and at the end
    let final = '';
    let prev = 0;
    for (let i = 1; i < opens.length; i++) {
      final += result.slice(prev, opens[i]);
      final += '</section>';
      prev = opens[i];
    }
    final += result.slice(prev);
    if (opens.length > 0) {
      final += '</section>';
    }

    return opens.length > 0 ? final : result;
  }
}
