import sanitizeHtml from "sanitize-html";

/**
 * Cleans the rich text written in the admin editor before it is stored and
 * later rendered on product pages. Only simple formatting survives; scripts,
 * event handlers, styles, iframes and unknown URL schemes are removed.
 */
export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "hr"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" } }),
    },
  }).trim();
}
