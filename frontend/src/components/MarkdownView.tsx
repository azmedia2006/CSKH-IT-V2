import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

// Inline formatting: Bold, Italic, Code, Links, Strikethrough
// Tokenize inline markdown safely without regex lookbehinds (ensures 100% compatibility with Safari/iOS WebKit)
export const tokenizeInline = (text: string): string[] => {
  const parts: string[] = [];
  let i = 0;
  let buffer = "";

  while (i < text.length) {
    // 1. Inline code: \`...\`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        if (buffer) { parts.push(buffer); buffer = ""; }
        parts.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // 2. Bold: **...**
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1 && end > i + 2) {
        if (buffer) { parts.push(buffer); buffer = ""; }
        parts.push(text.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    // 3. Bold: __...__
    if (text.startsWith("__", i)) {
      const end = text.indexOf("__", i + 2);
      if (end !== -1 && end > i + 2) {
        if (buffer) { parts.push(buffer); buffer = ""; }
        parts.push(text.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    // 4. Strikethrough: ~~...~~
    if (text.startsWith("~~", i)) {
      const end = text.indexOf("~~", i + 2);
      if (end !== -1 && end > i + 2) {
        if (buffer) { parts.push(buffer); buffer = ""; }
        parts.push(text.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    // 5. Link: [title](url)
    if (text[i] === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          if (buffer) { parts.push(buffer); buffer = ""; }
          parts.push(text.slice(i, closeParen + 1));
          i = closeParen + 1;
          continue;
        }
      }
    }

    // 6. Italic: *...*
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && end > i + 1 && text[end + 1] !== "*") {
        if (buffer) { parts.push(buffer); buffer = ""; }
        parts.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // 7. Italic: _..._
    if (text[i] === "_" && text[i + 1] !== "_") {
      const prevChar = i > 0 ? text[i - 1] : " ";
      const isWordChar = /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(prevChar);
      if (!isWordChar) {
        const end = text.indexOf("_", i + 1);
        if (end !== -1 && end > i + 1 && text[end + 1] !== "_") {
          const nextChar = end < text.length - 1 ? text[end + 1] : " ";
          if (!/[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(nextChar)) {
            if (buffer) { parts.push(buffer); buffer = ""; }
            parts.push(text.slice(i, end + 1));
            i = end + 1;
            continue;
          }
        }
      }
    }

    buffer += text[i];
    i++;
  }

  if (buffer) parts.push(buffer);
  return parts;
};

// Inline formatting: Bold, Italic, Code, Links, Strikethrough
export const renderInlineFormattedText = (text: string): React.ReactNode => {
  const parts = tokenizeInline(text);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold: **text** or __text__
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return (
        <strong key={index} className="font-bold text-slate-900">
          {renderInlineFormattedText(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic: *text* or _text_
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={index} className="italic text-slate-800">
          {renderInlineFormattedText(part.slice(1, -1))}
        </em>
      );
    }

    // Inline Code: `text`
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="bg-slate-100 text-indigo-600 font-mono text-[11px] px-1.5 py-0.5 rounded border border-slate-200 font-medium mx-0.5">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Link: [text](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 underline font-semibold transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    // Strikethrough: ~~text~~
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <del key={index} className="line-through text-slate-400">
          {renderInlineFormattedText(part.slice(2, -2))}
        </del>
      );
    }

    return part;
  });
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const rawLines = content.split('\n');
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Empty Line
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Horizontal Rule: --- or *** or ___
    if (/^(\-{3,}|\*{3,}|\_{3,})$/.test(trimmed)) {
      blocks.push(
        <hr key={`hr-${i}`} className="my-3 border-t border-slate-200" />
      );
      i++;
      continue;
    }

    // 3. Headings: #, ##, ###, ####
    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h2 key={`h1-${i}`} className="text-base sm:text-lg font-bold text-slate-900 mt-3 mb-1.5 tracking-tight border-b border-slate-100 pb-1">
          {renderInlineFormattedText(trimmed.slice(2))}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3 key={`h2-${i}`} className="text-sm sm:text-base font-bold text-slate-900 mt-2.5 mb-1 tracking-tight text-indigo-950">
          {renderInlineFormattedText(trimmed.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4 key={`h3-${i}`} className="text-xs sm:text-sm font-bold text-slate-900 mt-2 mb-1 text-indigo-900">
          {renderInlineFormattedText(trimmed.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      blocks.push(
        <h5 key={`h4-${i}`} className="text-xs font-bold text-slate-800 mt-1.5 mb-0.5 uppercase tracking-wide">
          {renderInlineFormattedText(trimmed.slice(5))}
        </h5>
      );
      i++;
      continue;
    }

    // 4. Code Block: ```language ... ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++; // skip closing ```
      blocks.push(
        <pre key={`code-${i}`} className="my-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] sm:text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // 5. Blockquote: > text (can span consecutive lines)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <div key={`quote-${i}`} className="my-2 p-3 bg-indigo-50/70 border-l-3 border-indigo-500 rounded-r-xl text-xs text-indigo-950 leading-relaxed font-normal shadow-2xs">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className={qIdx > 0 ? 'mt-1' : ''}>
              {renderInlineFormattedText(ql)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    // 6. Markdown Table: | Col 1 | Col 2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        tableLines.push(rawLines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // Parse Header
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());

        // Check if second line is separator |---|---|
        const isSeparator = /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(tableLines[1]);
        const startRowIdx = isSeparator ? 2 : 1;

        const bodyRows = tableLines.slice(startRowIdx).map(row => 
          row.split('|').slice(1, -1).map(c => c.trim())
        );

        blocks.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="min-w-full text-xs text-left text-slate-800 divide-y divide-slate-200">
              <thead className="bg-slate-50 font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                <tr>
                  {headerCells.map((th, thIdx) => (
                    <th key={thIdx} className="px-3.5 py-2.5 border-r last:border-r-0 border-slate-200 font-bold bg-slate-100/70">
                      {renderInlineFormattedText(th)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bodyRows.map((rowCells, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/40 hover:bg-indigo-50/30 transition-colors' : 'hover:bg-indigo-50/30 transition-colors'}>
                    {rowCells.map((td, tdIdx) => (
                      <td key={tdIdx} className="px-3.5 py-2 border-r last:border-r-0 border-slate-100 font-normal leading-relaxed">
                        {renderInlineFormattedText(td)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 7. Unordered List: * item or - item or • item
    if (/^(\*|-|•)\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^(\*|-|•)\s+/.test(rawLines[i].trim())) {
        listItems.push(rawLines[i].trim().replace(/^(\*|-|•)\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-1.5 pl-4 space-y-1 list-disc text-slate-700 text-xs marker:text-indigo-500">
          {listItems.map((it, lIdx) => (
            <li key={lIdx} className="leading-relaxed">
              {renderInlineFormattedText(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Ordered List: 1. item, 2. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i].trim())) {
        listItems.push(rawLines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-1.5 pl-4 space-y-1 list-decimal text-slate-700 text-xs font-normal marker:font-bold marker:text-indigo-600">
          {listItems.map((it, lIdx) => (
            <li key={lIdx} className="leading-relaxed">
              {renderInlineFormattedText(it)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Regular Paragraph
    blocks.push(
      <p key={`p-${i}`} className="my-1 leading-relaxed text-slate-800 font-normal text-xs sm:text-sm">
        {renderInlineFormattedText(trimmed)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-1 text-slate-800 leading-relaxed ${className}`}>{blocks}</div>;
};

export default MarkdownView;
