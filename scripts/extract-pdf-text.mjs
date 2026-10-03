import { createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { inflate } from 'node:zlib';

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error('Usage: node extract-pdf-text.mjs <input.pdf> <output.txt>');
  process.exit(1);
}

const buf = readFileSync(input);
const latin = buf.toString('latin1');

// Collect all stream ... endstream segments
const out = [];
let cursor = 0;
let streamIndex = 0;
while (true) {
  const start = latin.indexOf('stream', cursor);
  if (start === -1) break;
  const dataStart = start + 'stream'.length;
  // skip EOL
  let s = dataStart;
  if (buf[dataStart] === 0x0d) s += 1;
  if (buf[s] === 0x0a) s += 1;
  const end = latin.indexOf('endstream', s);
  if (end === -1) break;
  const raw = buf.subarray(s, end);
  cursor = end + 'endstream'.length;
  streamIndex++;

  let text = null;
  // Try FlateDecode
  try {
    text = inflate(raw).toString('latin1');
  } catch {
    text = raw.toString('latin1');
  }

  // Extract text-showing operators: (text) Tj / [(a) -x (b)] TJ / ' / "
  const tokens = [];
  const re = /\((?:\\.|[^()\\])*\)|\[(?:[^\[\]]|\\.)*\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    if (tok.startsWith('(')) {
      tokens.push(tok.slice(1, -1));
    } else {
      // array: concatenate all string literals inside
      const inner = tok
        .slice(1, -1)
        .match(/\((?:\\.|[^()\\])*\)/g);
      if (inner) tokens.push(inner.map((x) => x.slice(1, -1)).join(''));
    }
  }
  if (tokens.length) {
    out.push(tokens.join('').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\'));
  }
}

writeFileSync(output, out.join('\n'), 'utf8');
console.log(`Extracted ${out.length} text runs -> ${output}`);
