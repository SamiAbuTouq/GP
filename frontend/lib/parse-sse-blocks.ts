/** Parse one or more SSE blocks from a buffer; `rest` is an incomplete trailing block. */
export function parseSseBlocks(buffer: string): {
  events: { event: string; data: string }[];
  rest: string;
} {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: { event: string; data: string }[] = [];
  for (const block of parts) {
    if (!block.trim()) continue;
    let ev = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) ev = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trimStart();
    }
    events.push({ event: ev, data });
  }
  return { events, rest };
}
