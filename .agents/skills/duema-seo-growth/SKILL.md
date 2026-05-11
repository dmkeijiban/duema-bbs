---
name: duema-seo-growth
description: Improve SEO, structured data, summaries, internal links, indexability, and growth pages for the duema-bbs project. Use when the user asks about Search Console errors, canonical URLs, sitemap/robots/noindex, ranking pages, summary articles, related threads, Japanese card-game search intent, or traffic growth from Google.
---

# Duema SEO Growth

Use this skill to grow search traffic without damaging the forum UX.

## Principles

- Do not create thin, low-quality auto articles.
- Prefer useful forum-native pages over generic blog content.
- Do not copy or paraphrase competitor articles too closely.
- Avoid fake citations and avoid quoting other sites unless explicitly needed and allowed.
- Keep UI changes minimal unless the user asks for design work.
- Check rendered metadata and JSON-LD when fixing Search Console issues.

## High-Impact SEO Targets

Prioritize:

1. Indexability: canonical, sitemap, robots, noindex, redirects.
2. Structured data: `DiscussionForumPosting`, comments, author names, dates, images.
3. Internal links: related threads, category links, ranking/summary links.
4. Search-intent pages: high-demand Duema topics that genuinely help users.
5. Content quality: clear original explanations, not scraped summaries.

## Structured Data Checklist

For thread pages:

- Use canonical `https://www.duema-bbs.com/thread/[id]`.
- Include `headline`, `url`, `mainEntityOfPage`, `datePublished`, `dateModified`.
- Include `author.name`; default to an anonymous Duema user label if empty.
- Include `text`; fallback to title if body is empty.
- Include `image` when the thread has an image or generated OG image.
- Include comments with `Comment`, `author.name`, `text`, `datePublished`.
- Remove `undefined`, `null`, empty strings, and empty arrays from JSON-LD.

## Summary Article Rules

Good summary pages should:

- Explain the topic in original Japanese.
- Link to relevant categories and live threads.
- Use headings that match actual search intent:
  - Duema price spike / market movement
  - Duema new cards
  - Duema meta / environment
  - Duema deck advice
- Include enough context for beginners.
- Be publishable only when content quality is acceptable.

Bad summary pages:

- Generic filler.
- Duplicate links with no explanation.
- Broken links.
- Overloaded image blocks.
- Content that reads like an AI placeholder.

## Competitor Handling

Competitors may inspire topic selection and page structure, but do not copy:

- Gachi Matome
- Dene Blog
- Denen Hokankeikaku
- Cardrush

Use them only to understand what users search for and what information is expected.

## Verification

After SEO changes, check:

- `npx.cmd tsc --noEmit`
- `npm.cmd run build` for metadata/route changes
- Public `robots.txt`
- Public `sitemap.xml`
- Representative thread HTML for JSON-LD
- Search Console issue wording if provided by the user

## Output Style

Give the user a plain Japanese summary:

- What changed.
- What file changed.
- What was verified.
- What Google may take time to recrawl.
