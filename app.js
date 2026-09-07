const $ = (id) => document.getElementById(id);
const elements = { a: $("textA"), b: $("textB"), fileA: $("fileA"), fileB: $("fileB"), status: $("status"), results: $("results") };

const demoA = `Algorithms form the foundation of efficient computer programs. A string matching algorithm locates a pattern inside a longer sequence of characters. The Knuth Morris Pratt algorithm preprocesses the pattern to avoid repeated comparisons after a mismatch. This makes it especially useful for repetitive text. Data structures and careful analysis help us build reliable software.`;
const demoB = `Efficient programs are built on good algorithms. The Knuth-Morris-Pratt algorithm preprocesses the pattern to avoid repeated comparisons after a mismatch. This makes it especially useful for repetitive text! A detector should show evidence instead of only returning a number.`;

function normalize(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function sentences(text) {
  return text.match(/[^.!?\n]+[.!?]?/g)?.map((s) => s.trim()).filter((s) => normalize(s).length >= 16) || [];
}
function naiveSearch(text, pattern) {
  let comparisons = 0, matches = [];
  if (!pattern || pattern.length > text.length) return { matches, comparisons };
  for (let i = 0; i <= text.length - pattern.length; i++) {
    let j = 0;
    while (j < pattern.length) { comparisons++; if (text[i + j] !== pattern[j]) break; j++; }
    if (j === pattern.length) matches.push(i);
  }
  return { matches, comparisons };
}
function buildLPS(pattern) {
  const lps = Array(pattern.length).fill(0); let len = 0, i = 1, comparisons = 0;
  while (i < pattern.length) { comparisons++; if (pattern[i] === pattern[len]) lps[i++] = ++len; else if (len) len = lps[len - 1]; else i++; }
  return { lps, comparisons };
}
function kmpSearch(text, pattern) {
  const { lps, comparisons: prepComparisons } = buildLPS(pattern); let comparisons = 0, matches = [], i = 0, j = 0;
  while (i < text.length) { comparisons++; if (text[i] === pattern[j]) { i++; j++; if (j === pattern.length) { matches.push(i - j); j = lps[j - 1]; } } else if (j) j = lps[j - 1]; else i++; }
  return { matches, comparisons, prepComparisons };
}
function rangesFromMatches(matches) { return matches.map(({ start, length }) => [start, start + length]).sort((a,b) => a[0] - b[0]); }
function mergedRanges(ranges) { const out = []; for (const r of ranges) { const last = out[out.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else out.push([...r]); } return out; }
function renderHighlighted(container, text, patterns) {
  const ranges = [];
  const unique = [...new Set(patterns)].sort((a,b) => b.length-a.length);
  for (const phrase of unique) {
    const words = phrase.split(" ").filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
    if (!words.length) continue;
    const re = new RegExp(words.join("[\\s\\p{P}]+"), "giu"); let match;
    while ((match = re.exec(text))) ranges.push([match.index, match.index + match[0].length]);
  }
  const combined = mergedRanges(ranges); container.replaceChildren(); let cursor = 0;
  for (const [start, end] of combined) {
    if (start > cursor) container.append(document.createTextNode(text.slice(cursor, start)));
    const mark = document.createElement("mark"); mark.textContent = text.slice(start, end); container.append(mark); cursor = end;
  }
  if (cursor < text.length || !combined.length) container.append(document.createTextNode(text.slice(cursor)));
}
function fmt(n) { return new Intl.NumberFormat().format(n); }
function set(id, value) { $(id).textContent = value; }
function safeTime(fn) { const start = performance.now(); const value = fn(); return { value, time: performance.now() - start }; }

function analyze() {
  const originalA = elements.a.value.trim(), originalB = elements.b.value.trim();
  if (!originalA || !originalB) { elements.status.textContent = "Please add text to both documents before comparing."; return; }
  const a = normalize(originalA), b = normalize(originalB);
  if (!a || !b) { elements.status.textContent = "The text contains no searchable letters or numbers after preprocessing."; return; }
  const candidatePatterns = [...new Set(sentences(originalB).map(normalize))];
  let naiveComparisons = 0, kmpComparisons = 0, lpsWork = 0, naiveOccurrences = 0, kmpOccurrences = 0, naiveTime = 0, kmpTime = 0;
  const found = [];
  for (const pattern of candidatePatterns) {
    const naive = safeTime(() => naiveSearch(a, pattern)); const kmp = safeTime(() => kmpSearch(a, pattern));
    naiveComparisons += naive.value.comparisons; kmpComparisons += kmp.value.comparisons; lpsWork += kmp.value.prepComparisons;
    naiveOccurrences += naive.value.matches.length; kmpOccurrences += kmp.value.matches.length; naiveTime += naive.time; kmpTime += kmp.time;
    if (naive.value.matches.length) found.push({ pattern, positions: naive.value.matches, chars: pattern.length });
  }
  const agrees = naiveOccurrences === kmpOccurrences && found.every(({pattern, positions}) => JSON.stringify(positions) === JSON.stringify(kmpSearch(a, pattern).matches));
  const covered = mergedRanges(rangesFromMatches(found.flatMap((x) => x.positions.map((p) => ({ start: p, length: x.chars }))))).reduce((sum, [s,e]) => sum + e-s, 0);
  const score = Math.min(100, Math.round((covered / b.length) * 100));
  elements.results.classList.remove("hidden");
  set("score", score + "%"); $("meterFill").style.width = score + "%"; set("scoreDescription", `${fmt(covered)} of ${fmt(b.length)} normalized characters are covered by exact matching passages`);
  set("passageCount", found.length); set("matchedChars", `${fmt(covered)} characters covered`); set("occurrenceCount", fmt(naiveOccurrences));
  set("naiveOccurrences", fmt(naiveOccurrences)); set("naiveComparisons", fmt(naiveComparisons)); set("naiveTime", naiveTime.toFixed(3) + " ms");
  set("kmpOccurrences", fmt(kmpOccurrences)); set("kmpComparisons", fmt(kmpComparisons)); set("kmpTime", kmpTime.toFixed(3) + " ms"); set("lpsWork", fmt(lpsWork) + " comparisons");
  $("verification").textContent = agrees ? "✓ Both algorithms agree" : "! Verify results";
  const saved = naiveComparisons - (kmpComparisons + lpsWork); const ratio = naiveComparisons ? Math.max(0, Math.round((saved / naiveComparisons) * 100)) : 0;
  set("comparisonMessage", found.length ? `KMP used ${fmt(Math.max(0, saved))} fewer comparisons including LPS setup (${ratio}% less search work) while returning the same occurrences.` : "No exact normalized passage was found. Both algorithms correctly returned zero occurrences.");
  $("winnerIcon").textContent = saved > 0 ? "⚡" : "⌁";
  set("matchesLabel", `${found.length} passage${found.length === 1 ? "" : "es"}`);
  const list = $("matchList"); list.innerHTML = found.length ? found.map((x, i) => `<article class="match-item"><div class="match-meta"><span>PASSAGE ${i+1} · ${x.positions.length} occurrence${x.positions.length===1?"":"s"}</span><span>${x.chars} normalized chars</span></div><p>${x.pattern}</p></article>`).join("") : `<div class="empty">No exact passages were found after normalization. Try the demo or include a shared sentence of at least 16 characters.</div>`;
  renderHighlighted($("highlightA"), originalA, found.map((x) => x.pattern)); renderHighlighted($("highlightB"), originalB, found.map((x) => x.pattern));
  elements.status.textContent = `Analysis complete: ${found.length} matching passage${found.length === 1 ? "" : "s"} found.`;
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
}
function updateCounts(){ set("countA", `${fmt(elements.a.value.length)} characters`); set("countB", `${fmt(elements.b.value.length)} characters`); }
function loadFile(input, target) { const file = input.files[0]; if (!file) return; if (file.size > 2_000_000) { elements.status.textContent = "Please choose a text file smaller than 2 MB for this local demo."; return; } const reader = new FileReader(); reader.onload = () => { target.value = reader.result; updateCounts(); elements.status.textContent = `${file.name} loaded.`; }; reader.readAsText(file); }
$("compareBtn").addEventListener("click", analyze);
$("demoBtn").addEventListener("click", () => { elements.a.value = demoA; elements.b.value = demoB; updateCounts(); elements.status.textContent = "Demo loaded — click Compare documents."; });
$("clearBtn").addEventListener("click", () => { elements.a.value = ""; elements.b.value = ""; elements.results.classList.add("hidden"); updateCounts(); elements.status.textContent = "Inputs cleared."; });
elements.a.addEventListener("input", updateCounts); elements.b.addEventListener("input", updateCounts); elements.fileA.addEventListener("change", () => loadFile(elements.fileA, elements.a)); elements.fileB.addEventListener("change", () => loadFile(elements.fileB, elements.b));
updateCounts();
