// The little Markdown of the entries (changes/README.md): paragraphs, lists, bold, italic, links and images.
// Everything is escaped first; links keep only http(s) and absolute paths, images also embedded ones (data:).

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const safeUrl = (url: string): string | null => (/^(https?:\/\/|\/(?!\/))/.test(url) ? url : null);
const safeImage = (url: string): string | null => safeUrl(url) ?? (/^data:image\/(jpeg|png|webp|gif);base64,[\w+/=]+$/.test(url) ? url : null);

export function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, alt: string, src: string) => {
      const url = safeImage(src);
      return url ? `<img src="${url}" alt="${alt}" loading="lazy">` : whole;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_whole, label: string, href: string) => {
      const url = safeUrl(href);
      return url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : label;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

export function renderMarkdown(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${inlineMarkdown(lines.join(' '))}</p>`;
    })
    .join('');
}
