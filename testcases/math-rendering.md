# Math Rendering Testcases

Regression checks for ZenReader math extraction/rendering. Run after changes to `math-grabber.js`, `content.js` `preprocessMath()`, or `reader/core.js` `renderMath()`.

## Chrome vs Firefox parity note

Firefox `reader/core.js` renders math with KaTeX auto-render and does **not** ignore `p/div/h1-h6`. Chrome keeps `p, div, h1-h6` in `ignoredTags` for the broad pass to reduce false positives from currency/ordinary `$...$` text in normal prose. To avoid losing NVIDIA-style inline math, Chrome adds a **targeted second pass**: only block elements that still contain raw LaTeX delimiters are rendered with `p/div/h1-h6` not ignored.

Do not remove `p,div,h1-h6` from the broad pass without a replacement strategy and regression coverage for false-positive `$` rendering.

## Case: NVIDIA inline math in paragraphs

- URL: `https://developer.nvidia.com/blog/ai-model-co-design-hardware-friendly-llm-design/`
- Issue: Inline math in normal paragraphs rendered as raw delimiters, e.g. `$L$`, `$H$`, `$H'$`.
- Expected: KaTeX renders inline math; no raw `$...$` math delimiters visible in article text.
- Reader console diagnostic:

```js
({
  katex: document.querySelectorAll('#article-body .katex').length,
  rawDollar: document.body.innerText.match(/\$[A-Za-z][^$\n]{0,20}\$/g)?.slice(0, 10),
  sampleP: [...document.querySelectorAll('#article-body p')]
    .find(p => /\$L\$|\$H\$/.test(p.textContent))
    ?.outerHTML.slice(0, 300)
})
```

- Pass signal: `katex > 0`, `rawDollar` empty/irrelevant, sample paragraph contains `.katex` not raw `$L$`.
- Known bad signal (before fix): `katex: 0`, `rawDollar` contains `$L$,$H$,$H'$`, sample paragraph shows raw delimiters in `<p>`.
