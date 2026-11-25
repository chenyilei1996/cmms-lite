import type { ReactNode } from "react";

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

/**
 * 轻量正文渲染：空行分段、`##` 小标题、`-` 无序列表、`1.` 有序列表。
 * 不解析 HTML，避免富文本注入，现场录入也足够直观。
 */
export function KbBody({ content }: { content: string }) {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "list" && !last.ordered) last.items.push(bullet[1]);
      else blocks.push({ type: "list", ordered: false, items: [bullet[1]] });
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "list" && last.ordered) {
        last.items.push(numbered[1]);
      } else {
        blocks.push({ type: "list", ordered: true, items: [numbered[1]] });
      }
      continue;
    }

    const last = blocks[blocks.length - 1];
    if (last && last.type === "paragraph") {
      last.text += `\n${line}`;
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }

  const rendered: ReactNode[] = blocks.map((block, index) => {
    if (block.type === "heading") {
      return (
        <h3
          key={index}
          className="mt-6 mb-2 text-[14px] font-semibold text-ink first:mt-0"
        >
          {block.text}
        </h3>
      );
    }
    if (block.type === "list") {
      const items = block.items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {item}
        </li>
      ));
      return block.ordered ? (
        <ol key={index} className="my-3 list-decimal space-y-1.5 pl-5 text-[13px] text-ink-soft">
          {items}
        </ol>
      ) : (
        <ul key={index} className="my-3 list-disc space-y-1.5 pl-5 text-[13px] text-ink-soft">
          {items}
        </ul>
      );
    }
    return (
      <p
        key={index}
        className="my-3 whitespace-pre-line text-[13px] leading-[1.85] text-ink-soft first:mt-0"
      >
        {block.text}
      </p>
    );
  });

  return <div>{rendered}</div>;
}
