import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import './NewsMarkdown.css';

const parser = new MarkdownIt('commonmark', Object.assign({ html: false, breaks: true, linkify: true }, { maxNesting: 20 }))
  .disable(['image', 'heading', 'lheading', 'hr', 'reference'])
  .enable('linkify');
parser.linkify.set({ fuzzyLink: false, fuzzyEmail: false });
parser.validateLink = (url: string) => {
  if (/[\x00-\x1f\\]/.test(url)) return false;
  if (url.startsWith('#') || (url.startsWith('/') && !url.startsWith('//'))) return true;
  try {
    const value = new URL(url);
    return ['http:', 'https:'].includes(value.protocol) && !!value.hostname && !value.username && !value.password;
  } catch { return false; }
};

export const NewsMarkdown: React.FC<{ source: string; collapsed?: boolean }> = ({ source, collapsed }) => {
  const html = useMemo(() => parser.render(String(source || '').slice(0, 50000)), [source]);
  const openLink = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute('href') || '';
    if (!parser.validateLink(href)) return;
    const url = new URL(href, 'https://mc.sotocoming.ru/news').href;
    if (window.electronAPI?.openExternal) void window.electronAPI.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };
  // Only the configured parser produces HTML: source HTML and images are disabled.
  return <div className={`launcher-markdown ${collapsed ? 'is-collapsed' : ''}`} onClick={openLink} dangerouslySetInnerHTML={{ __html: html }} />;
};
