const text = `710.Eliza Mwongeli-0769187118

Masha Kalama 0119260797
712.Shilah yegon07986510455
682 .mayaka samwuel 
 0715 791021.         383. Shem Edward+254 701 251561`;

const PHONE_RE = /(\+?254[ \t-]?\d[\d \t-]{6,12}\d|0\d[\d \t-]{6,10}\d)/g;

let lastIndex = 0;
let match;
const entries = [];

while ((match = PHONE_RE.exec(text)) !== null) {
  const chunk = text.substring(lastIndex, match.index + match[0].length);
  entries.push(chunk.trim());
  lastIndex = match.index + match[0].length;
}

console.log(entries);
