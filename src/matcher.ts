import { App, TFile } from "obsidian";
import { CandidateNote, LinkSuggestion } from "./types";

interface SentenceSpan {
  from: number;
  to: number;
  insertAt: number; // position right after sentence-ending punctuation
}

export class LinkMatcher {
  constructor(private app: App) {}

  async generateSuggestions(
    content: string,
    candidates: CandidateNote[],
    range?: { from: number; to: number }
  ): Promise<LinkSuggestion[]> {
    const rangeFrom = range?.from ?? 0;
    const rangeTo = range?.to ?? content.length;

    const suggestions: LinkSuggestion[] = [];
    const usedRanges: Array<{ from: number; to: number }> = [];
    const existingLinkSpans = this.findWikilinkSpans(content);
    const matchedFilePaths = new Set<string>();

    // Pass 1: exact title / alias text match (range 내에서만)
    for (const { file, score } of candidates) {
      const terms = this.buildSearchTerms(file);
      for (const { text: term, type } of terms) {
        if (term.length < 2) continue;
        let cursor = rangeFrom;
        while (cursor < rangeTo) {
          const idx = content.indexOf(term, cursor);
          if (idx === -1 || idx >= rangeTo) break;
          const from = idx;
          const to = idx + term.length;
          cursor = to;
          if (this.isInsideSpan(existingLinkSpans, from, to)) continue;
          if (this.overlaps(usedRanges, from, to)) continue;
          if (!this.isWordBoundary(content, from, to)) continue;
          usedRanges.push({ from, to });
          matchedFilePaths.add(file.path);
          suggestions.push({ text: term, from, to, targetFile: file, matchType: type, score });
        }
      }
    }

    // Pass 2: sentence-end insertion (range 내 문장만 대상)
    const contextCandidates = candidates.filter(
      (c) => !matchedFilePaths.has(c.file.path) && c.matchLevel >= 2
    );
    if (contextCandidates.length > 0) {
      const insertions = await this.findSentenceInsertions(
        content,
        contextCandidates,
        existingLinkSpans,
        { from: rangeFrom, to: rangeTo }
      );
      suggestions.push(...insertions);
    }

    return suggestions.sort((a, b) => b.from - a.from);
  }

  private async findSentenceInsertions(
    content: string,
    candidates: CandidateNote[],
    existingLinkSpans: Array<{ from: number; to: number }>,
    range: { from: number; to: number }
  ): Promise<LinkSuggestion[]> {
    const sentences = this.extractSentenceSpans(content).filter(
      (s) => s.from >= range.from && s.to <= range.to
    );
    const insertions: LinkSuggestion[] = [];

    for (const { file, score } of candidates) {
      const fileContent = await this.app.vault.cachedRead(file);
      const fileKeywords = this.extractKeywordsSet(fileContent);

      let bestSentence: SentenceSpan | null = null;
      let bestKeywords: string[] = [];

      for (const sentence of sentences) {
        if (this.isInsideSpan(existingLinkSpans, sentence.from, sentence.to)) continue;

        const sentenceText = content.slice(sentence.from, sentence.to);
        const sentenceKeywords = this.extractKeywordsSet(sentenceText);

        const matched: string[] = [];
        for (const word of sentenceKeywords) {
          if (fileKeywords.has(word)) matched.push(word);
        }

        if (matched.length > bestKeywords.length) {
          bestKeywords = matched;
          bestSentence = sentence;
        }
      }

      if (bestSentence && bestKeywords.length >= 1) {
        const sentenceText = content.slice(bestSentence.from, bestSentence.to).trim();
        insertions.push({
          text: sentenceText,
          from: bestSentence.insertAt,
          to: bestSentence.insertAt,
          targetFile: file,
          matchType: "context",
          score,
          isInsert: true,
          matchKeywords: bestKeywords,
        });
      }
    }

    return insertions;
  }

  // Splits prose into sentence spans (skips headings, code fences, blank lines)
  private extractSentenceSpans(content: string): SentenceSpan[] {
    const spans: SentenceSpan[] = [];
    // Match sequences of 10+ non-newline chars ending with sentence punctuation
    const re = /[^\n#]{10,}[.!?。]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      spans.push({
        from: m.index,
        to: m.index + m[0].length,
        insertAt: m.index + m[0].length,
      });
    }
    return spans;
  }

  private buildSearchTerms(
    file: TFile
  ): Array<{ text: string; type: LinkSuggestion["matchType"] }> {
    const terms: Array<{ text: string; type: LinkSuggestion["matchType"] }> = [
      { text: file.basename, type: "title" },
    ];
    const cache = this.app.metadataCache.getFileCache(file);
    const raw =
      cache?.frontmatter?.aliases ?? cache?.frontmatter?.alias ?? [];
    const aliases: string[] = Array.isArray(raw)
      ? raw.map(String)
      : typeof raw === "string"
      ? [raw]
      : [];
    for (const alias of aliases) {
      terms.push({ text: alias, type: "alias" });
    }
    return terms;
  }

  private extractKeywordsSet(text: string): Set<string> {
    const korean = text.match(/[가-힣]{2,}/g) ?? [];
    const english = text.match(/[a-zA-Z]{3,}/g)?.map((w) => w.toLowerCase()) ?? [];
    return new Set([...korean, ...english]);
  }

  private findWikilinkSpans(
    content: string
  ): Array<{ from: number; to: number }> {
    const spans: Array<{ from: number; to: number }> = [];
    const re = /\[\[[^\]]+\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      spans.push({ from: m.index, to: m.index + m[0].length });
    }
    return spans;
  }

  private isInsideSpan(
    spans: Array<{ from: number; to: number }>,
    from: number,
    to: number
  ): boolean {
    return spans.some((s) => from >= s.from && to <= s.to);
  }

  private overlaps(
    ranges: Array<{ from: number; to: number }>,
    from: number,
    to: number
  ): boolean {
    return ranges.some((r) => from < r.to && to > r.from);
  }

  private isWordBoundary(content: string, from: number, to: number): boolean {
    if (/[가-힣]/.test(content[from])) return true;
    const prev = from > 0 ? content[from - 1] : " ";
    const next = to < content.length ? content[to] : " ";
    return !/\w/.test(prev) && !/\w/.test(next);
  }
}
