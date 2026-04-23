# Auto Link

An Obsidian plugin that analyzes your note's content, discovers related documents across your Vault, and inserts wiki-links after your confirmation.

---

## Features

### 1. Note Analysis

When triggered, the plugin automatically parses the current note's content.

- Strips markdown syntax (headings, links, code blocks, etc.) to extract plain text
- Analyzes keyword frequency — Korean (2+ chars) and English (3+ chars)
- Collects tags, headings, and frontmatter metadata
- **Selection-aware**: If you have text selected when the plugin runs, analysis and suggestions are scoped to the selected portion only

---

### 2. Related Note Discovery (3-Level Priority)

Scans all markdown files in your Vault and scores each one for relevance.

| Level | Criteria | Base Score |
|-------|----------|------------|
| **Level 1** | Another note's title or alias appears verbatim in the current note | +100 |
| **Level 2** | Keyword frequency similarity (TF-IDF style) | up to +80 |
| **Level 3** | Shared tags, heading keyword overlap | +15 per tag |

Notes below the configured minimum score are excluded from suggestions.

---

### 3. Link Insertion Modes

Discovered candidates are linked in one of two ways depending on how the match was found.

#### Replacement (Title / Alias Match)

Finds text in the current note that exactly matches another note's title or alias, and replaces it with a `[[link]]`.

```
I studied artificial intelligence today.
→ I studied [[Artificial Intelligence]] today.
```

When an alias matches, pipe syntax is used automatically.

```
I studied AI today.
→ I studied [[Artificial Intelligence|AI]] today.
```

#### Insertion (Context Match)

When a note is relevant by keyword overlap but its title does not appear in the text, the plugin inserts a link at the end of the sentence with the highest keyword overlap. Multiple candidates at the same position are joined with ` · `.

```
I was thinking about how to manage knowledge better today.
→ I was thinking about how to manage knowledge better today. <small>[[Zettelkasten]] · [[Second Brain]]</small>
```

> Inserted links are wrapped in `<small>` tags and appear visually smaller than body text in Reading Mode. In Edit Mode, the raw tags are visible.

---

### 4. Confirmation Modal

Before any changes are made, a confirmation dialog lists all suggested links. You can select exactly which ones to apply.

**Each suggestion displays:**

- A preview of the source text (truncated to 40 characters) `→` or `+` the target link
- Match type badge: `Title Match` / `Alias Match` / `Context Insertion`
- Match score
- For context insertions: the full list of keywords that caused the match

**Suggestion groups:**

- Exact text matches (replacement)
- Context-based candidates (insertion)

**Buttons:** Select All / Deselect All · Apply Links / Cancel

---

## Usage

1. Open the note you want to link, or drag-select a specific passage.
2. Trigger the plugin by either:
   - Clicking the 🔗 icon in the left ribbon
   - Opening the command palette (`Ctrl+P`) → **Find links in current note**
3. The plugin runs through analysis → discovery → mapping automatically.
4. In the confirmation dialog, select the links you want and click **Apply Links**.

---

## Installation

1. Build the plugin:
   ```bash
   npm install
   npm run build
   ```
2. Copy `main.js`, `manifest.json`, and `styles.css` into your Vault at:
   ```
   <your-vault>/.obsidian/plugins/obsidian-autolink/
   ```
3. In Obsidian, go to **Settings → Community Plugins** and enable **Auto Link**.

---

## Settings

Go to **Settings → Auto Link** to configure the following options.

| Option | Default | Description |
|--------|---------|-------------|
| Minimum match score | 20 | Notes below this score are excluded from suggestions |
| Maximum suggestions | 50 | Maximum number of link suggestions shown at once |
| Excluded folders | *(none)* | Comma-separated folder paths to skip (e.g. `Templates, Archive`) |

---

## Notes

- Runs entirely offline — no external API or internet connection required.
- Supports Korean and English text.
- Text already wrapped in `[[links]]` is never suggested again.
- Inserted links use `<small>` HTML tags, which render smaller in Reading Mode. In Edit Mode, the raw tags are visible.
