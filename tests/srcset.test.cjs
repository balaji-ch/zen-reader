// Unit tests for lib/srcset.js (run with `npm test`).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseSrcset,
  resolveSrcset,
  pickLargestFromSrcset,
} = require('../lib/srcset.js');

const BASE = 'https://www.siliconcodesign.com/p/ai-accelerators-a-primer';
const PNG = 'https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F9fc1d7f2-07bb-4f31-b8f8-e45d5db0496b_237x91.png';

function substackUrl(width, format = 'f_webp') {
  return `https://substackcdn.com/image/fetch/$s_!U3ob!,w_${width},c_limit,${format},q_auto:good,fl_progressive:steep/${PNG}`;
}

test('parses srcset URLs that contain commas (Substack CDN)', () => {
  const srcset = `${substackUrl(424)} 424w, ${substackUrl(1456)} 1456w`;
  const candidates = parseSrcset(srcset);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].url, substackUrl(424));
  assert.deepEqual(candidates[0].descriptors, ['424w']);
  assert.equal(candidates[1].url, substackUrl(1456));
  assert.deepEqual(candidates[1].descriptors, ['1456w']);
});

test('resolveSrcset keeps comma URLs intact instead of mangling them', () => {
  const srcset = `${substackUrl(424)} 424w, /local/a.png 848w`;
  const resolved = resolveSrcset(srcset, BASE);

  assert.ok(resolved.includes(substackUrl(424)));
  assert.ok(resolved.includes('https://www.siliconcodesign.com/local/a.png 848w'));
  // Regression: fragments must never be resolved as paths.
  assert.ok(!resolved.includes('/p/w_424'));
  assert.ok(!resolved.includes('/p/c_limit'));
  // Re-parsing the resolved value yields the same URL count.
  assert.equal(parseSrcset(resolved).length, 2);
});

test('resolves protocol-relative and root-relative candidates', () => {
  const resolved = resolveSrcset('//cdn.example.com/a.png 1x, /b.png 2x', BASE);
  assert.equal(
    resolved,
    `https://cdn.example.com/a.png 1x, https://www.siliconcodesign.com/b.png 2x`
  );
});

test('handles density descriptors and descriptor-less candidates', () => {
  assert.deepEqual(
    parseSrcset('a.png 1x, b.png 2x').map((c) => [c.url, c.descriptors.join(' ')]),
    [['a.png', '1x'], ['b.png', '2x']]
  );

  assert.deepEqual(
    parseSrcset('a.png, b.png').map((c) => [c.url, c.descriptors.join(' ')]),
    [['a.png', ''], ['b.png', '']]
  );

  // A comma is a valid URL character, so this is one candidate per spec.
  assert.deepEqual(
    parseSrcset('a.png,b.png 2x').map((c) => [c.url, c.descriptors.join(' ')]),
    [['a.png,b.png', '2x']]
  );
});

test('tolerates extra whitespace, newlines and leading commas', () => {
  const candidates = parseSrcset('\n  , a.png 100w,\n\t b.png 200w ,  ');
  assert.deepEqual(candidates.map((c) => c.url), ['a.png', 'b.png']);
  assert.deepEqual(candidates.map((c) => c.descriptors), [['100w'], ['200w']]);
});

test('leaves data: and blob: URLs untouched', () => {
  const srcset = 'data:image/png;base64,AAAA 1x, blob:https://example.com/abc 2x';
  const resolved = resolveSrcset(srcset, BASE);
  assert.ok(resolved.startsWith('data:image/png;base64,AAAA 1x, '));
  assert.ok(resolved.includes('blob:https://example.com/abc 2x'));
});

test('pickLargestFromSrcset uses the width descriptor, not comma order', () => {
  const srcset = `${substackUrl(424)} 424w, ${substackUrl(1456)} 1456w, ${substackUrl(848)} 848w`;
  assert.equal(pickLargestFromSrcset(srcset), substackUrl(1456));
});

test('pickLargestFromSrcset falls back to density then last candidate', () => {
  assert.equal(pickLargestFromSrcset('a.png 1x, b.png 3x, c.png 2x'), 'b.png');
  assert.equal(pickLargestFromSrcset('a.png, b.png'), 'b.png');
});

test('empty or missing srcset yields no candidates', () => {
  assert.deepEqual(parseSrcset(''), []);
  assert.deepEqual(parseSrcset(null), []);
  assert.equal(pickLargestFromSrcset(''), null);
});
