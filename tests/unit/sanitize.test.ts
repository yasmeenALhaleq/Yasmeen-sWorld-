import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDescription } from "../../src/lib/sanitize.ts";

test("normal formatting is kept", () => {
  const html = "<h2>Soft</h2><p>Made with <strong>shea</strong> and <em>oats</em>.</p><ul><li>One</li><li>Two</li></ul>";
  assert.equal(sanitizeDescription(html), html);
});

test("scripts, event handlers and styles are removed", () => {
  const out = sanitizeDescription('<p onclick="steal()" style="color:red">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://evil.test"></iframe>');
  assert.equal(out, "<p>Hi</p>");
});

test("javascript: and data: links are dropped, normal links get safe attributes", () => {
  // An anchor without an href is inert, so only the absence of the dangerous URL matters.
  for (const bad of ["javascript:alert(1)", "data:text/html;base64,AAAA", "//evil.test/x", "JaVaScRiPt:alert(1)", " vbscript:x"]) {
    const out = sanitizeDescription(`<a href="${bad}">x</a>`);
    assert.doesNotMatch(out, /href/, bad);
  }
  const link = sanitizeDescription('<a href="https://example.com/page">x</a>');
  assert.match(link, /href="https:\/\/example\.com\/page"/);
  assert.match(link, /rel="noopener noreferrer nofollow"/);
  assert.match(link, /target="_blank"/);
});

test("unknown tags lose their markup but keep their text", () => {
  assert.equal(sanitizeDescription("<div><span>Hello</span></div>"), "Hello");
});
