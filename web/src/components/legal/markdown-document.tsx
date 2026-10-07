import type { ReactNode } from "react";

function inline(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g);
  return parts.filter(Boolean).map((part, index) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) return <strong key={index} className="font-semibold text-[#25202d]">{bold[1]}</strong>;

    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} className="font-semibold text-[#2e2877] underline underline-offset-2">{link[1]}</a>;

    return part;
  });
}

function isTableRow(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function isTableDivider(line: string) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line);
}

function tableCells(line: string) {
  return line.slice(1, -1).split("|").map(cell => cell.trim());
}

export function MarkdownDocument({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (line === "---") {
      blocks.push(<hr key={index} className="my-8 border-[#e6dfd8]" />);
      index += 1;
      continue;
    }

    if (isTableRow(line) && isTableDivider(lines[index + 1] || "")) {
      const header = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (isTableRow(lines[index] || "")) rows.push(tableCells(lines[index++]));
      blocks.push(<div key={index} className="my-6 overflow-x-auto rounded-xl border border-[#e6dfd8]"><table className="w-full min-w-[560px] border-collapse text-left text-sm"><thead className="bg-[#f3dfd1] text-[#2e2877]"><tr>{header.map((cell, cellIndex) => <th key={cellIndex} className="px-4 py-3 font-semibold">{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#eee8e2] align-top">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 leading-6">{inline(cell)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2]);
      blocks.push(level === 1 ? <h1 key={index} className="mt-2 text-3xl font-bold tracking-tight text-[#2e2877] sm:text-4xl">{content}</h1> : level === 2 ? <h2 key={index} className="mt-10 text-xl font-bold text-[#2e2877] sm:text-2xl">{content}</h2> : <h3 key={index} className="mt-7 text-base font-bold text-[#25202d]">{content}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while ((lines[index] || "").startsWith("- ")) items.push(lines[index++].slice(2));
      blocks.push(<ul key={index} className="my-4 list-disc space-y-2 pl-6">{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>);
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (lines[index]?.trim() && !lines[index].startsWith("#") && !lines[index].startsWith("- ") && lines[index] !== "---" && !isTableRow(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={index} className="my-4 leading-7">{inline(paragraph.join(" "))}</p>);
  }

  return <div className="text-[15px] text-[#5f5964] sm:text-base">{blocks}</div>;
}
