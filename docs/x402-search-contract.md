# x402 Search Contract

This document defines the runtime meaning of `x402_search` result metadata so
tool instructions, logs, widgets, and future implementations stay aligned.

## Default Behavior

- `x402_search` is the first step for API discovery.
- Broad terms like `crypto`, `image`, `trading`, and `analytics` are valid.
- `verifiedOnly` is opt-in, not default.
- Sorting is separate from search execution mode.

## `searchMeta.mode`

### `direct`

The marketplace returned exact or strong matches directly from the initial
search query.

Use when:
- The original query produced usable results immediately.

Model guidance:
- Present the results as normal search results.

### `normalized_browse`

The original query was normalized into a broader marketplace browse, usually
because the query was wildcard-like or too weak to treat as a meaningful exact
search term.

Use when:
- The search term was effectively empty after normalization.

Model guidance:
- Explain that the request was interpreted as a broad browse.

### `fuzzy_broad`

No strong direct matches were found. The search broadened to a larger catalog
scan and ranked related matches using fuzzy token scoring.

Use when:
- The user’s term is valid, but direct search came back empty or weak.

Model guidance:
- Describe the results as closest related matches, not exact matches.

### `empty_after_fallback`

Neither direct search nor the broader fallback scan produced close enough
matches.

Use when:
- The query could not be matched meaningfully even after fallback.

Model guidance:
- Say no exact or close matches were found.
- Suggest broader or adjacent search terms, categories, or networks.

## Sort Is Not Mode

The following are sort strategies, not search execution modes:

- `marketplace`
- `relevance`
- `quality_score`
- `settlements`
- `volume`
- `recent`

Keep these conceptually separate in prompts, logs, and UI.
