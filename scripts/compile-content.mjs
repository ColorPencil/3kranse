import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const root = process.cwd();
const entries = [];
for (const category of ['guides', 'manual', 'creators', 'devlog']) {
  for (const lang of ['ja', 'zh-cn', 'en']) {
    const dir = path.join(root, 'content', category, lang);
    for (const file of readdirSync(dir).filter(file => file.endsWith('.md'))) {
      const { data, content } = matter(readFileSync(path.join(dir, file), 'utf8'));
      const toc = [];
      const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
      const originalHeading = md.renderer.rules.heading_open;
      md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
        const heading = tokens[index + 1].content;
        const id = `section-${toc.length + 1}`;
        tokens[index].attrSet('id', id);
        toc.push({ id, text: heading, level: Number(tokens[index].tag.slice(1)) });
        return originalHeading ? originalHeading(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
      };
      const html = md.render(content);
      entries.push({ ...data, category, lang, slug: file.slice(0, -3), html, toc });
    }
  }
}
mkdirSync(path.join(root, 'src/generated'), { recursive: true });
writeFileSync(path.join(root, 'src/generated/content.json'), JSON.stringify(entries, null, 2));
console.log(`Compiled ${entries.length} Markdown articles.`);
