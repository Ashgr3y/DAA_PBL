# MatchLens — Naïve vs KMP Text Similarity Detector

This is a dependency-free classroom showcase for DAA PBL topic #23: **“Build a Plagiarism / Text Similarity Detector comparing Naïve String Matching and the KMP Algorithm.”**

## Run it

1. Open `index.html` in any current web browser.
2. Or, from this folder, run `python -m http.server 8000` and visit `http://localhost:8000`.
3. Click **Load demo** for a prepared example, or paste/upload two `.txt` documents.
4. Click **Compare documents**.

No packages, server, account, AI model, or internet connection are required.

## What the project does

- Applies the **same normalization** to both documents: lowercase, punctuation removal, whitespace cleanup.
- Extracts meaningful sentence/passages from Document B (the document being checked).
- Searches each passage in Document A using two genuinely separate implementations:
  - **Naïve String Matching** — tests every possible alignment character by character.
  - **Knuth–Morris–Pratt (KMP)** — builds an LPS table and avoids rechecking known prefixes.
- Verifies that both algorithms produce the same occurrence positions.
- Shows matching passages, original-text highlights, occurrence count, character comparisons, preprocessing work, and elapsed time.
- Calculates an **exact-overlap score**: the percent of the normalized checked document covered by passages found in the reference document. It is an educational text-overlap indicator, not a legal plagiarism verdict.

## Complexity for viva

For text length `n` and pattern length `m`:

| Algorithm | Preprocessing | Search worst case | Extra space |
| --- | --- | --- | --- |
| Naïve | none | `O(n × m)` | `O(1)` |
| KMP | build LPS: `O(m)` | `O(n + m)` | `O(m)` |

KMP is typically most advantageous with repetitive text/patterns because the LPS table tells it how far the pattern can shift after a mismatch.

## Suggested classroom demo

1. Load the demo and point out the highlighted copied passages.
2. Show that Naïve and KMP report the **same matches** (correctness), but KMP generally uses fewer character comparisons (efficiency).
3. Change one copied sentence, add punctuation/case variation, and rerun to show consistent preprocessing.
4. Open the **Algorithm & viva notes** panel and explain the LPS table and the complexity table.

## Limitations (state these confidently)

This project deliberately measures **exact normalized passage overlap** to demonstrate string matching algorithms. Paraphrases, translated text, synonym substitution, and semantic similarity are outside its scope; handling those would require a different technique and would not replace the required Naïve/KMP core.
