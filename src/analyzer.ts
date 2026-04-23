import { App, TFile, CachedMetadata } from "obsidian";
import { NoteAnalysis } from "./types";

const KOREAN_STOPWORDS = new Set([
  "이", "그", "저", "것", "수", "있", "없", "하", "되", "된",
  "있다", "없다", "하다", "이다", "으로", "에서", "에게", "부터", "까지",
  "그리고", "하지만", "그러나", "그런데", "따라서", "또한", "즉", "및", "등",
  "를", "을", "이", "가", "은", "는", "의", "에", "로", "과", "와", "도", "만", "한",
]);

const ENGLISH_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "is", "are", "was", "were", "be", "been", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "this", "that", "these", "those", "it", "its", "they", "we", "you", "he", "she",
]);

export class NoteAnalyzer {
  constructor(private app: App) {}

  async analyze(file: TFile): Promise<NoteAnalysis> {
    const content = await this.app.vault.cachedRead(file);
    const cache = this.app.metadataCache.getFileCache(file);
    return this.analyzeContent(content, cache);
  }

  // 선택 영역처럼 이미 읽어온 텍스트를 분석할 때 사용
  analyzeContent(rawContent: string, cache: CachedMetadata | null = null): NoteAnalysis {
    const cleanContent = this.stripMarkdown(rawContent);
    return {
      keywords: this.extractKeywords(cleanContent),
      headings: this.extractHeadings(cache),
      tags: this.extractTags(cache),
      frontmatter: (cache?.frontmatter ?? {}) as Record<string, unknown>,
      sentences: this.extractSentences(cleanContent),
    };
  }

  stripMarkdown(content: string): string {
    return content
      .replace(/^---[\s\S]*?---\n/m, "")
      .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/[#*_~>]/g, "")
      .trim();
  }

  extractKeywords(text: string): Map<string, number> {
    const freq = new Map<string, number>();

    const koreanWords = text.match(/[가-힣]{2,}/g) ?? [];
    const englishWords =
      text.match(/[a-zA-Z]{3,}/g)?.map((w) => w.toLowerCase()) ?? [];

    for (const word of koreanWords) {
      if (!KOREAN_STOPWORDS.has(word)) {
        freq.set(word, (freq.get(word) ?? 0) + 1);
      }
    }
    for (const word of englishWords) {
      if (!ENGLISH_STOPWORDS.has(word)) {
        freq.set(word, (freq.get(word) ?? 0) + 1);
      }
    }

    return freq;
  }

  private extractHeadings(cache: CachedMetadata | null): string[] {
    return cache?.headings?.map((h) => h.heading) ?? [];
  }

  private extractTags(cache: CachedMetadata | null): string[] {
    const tags: string[] = [];
    if (cache?.tags) {
      tags.push(...cache.tags.map((t) => t.tag.replace("#", "")));
    }
    const fm = cache?.frontmatter?.tags;
    if (Array.isArray(fm)) tags.push(...fm.map(String));
    else if (typeof fm === "string") tags.push(fm);
    return [...new Set(tags)];
  }

  private extractSentences(text: string): string[] {
    return text.split(/[.!?。]\s+/).filter((s) => s.trim().length > 10);
  }
}
