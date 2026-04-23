import { App, TFile } from "obsidian";
import { NoteAnalysis, CandidateNote } from "./types";
import { NoteAnalyzer } from "./analyzer";

interface SearchSettings {
  minMatchScore: number;
  excludeFolders: string[];
}

export class NoteSearcher {
  private analyzer: NoteAnalyzer;

  constructor(private app: App) {
    this.analyzer = new NoteAnalyzer(app);
  }

  async findCandidates(
    currentFile: TFile,
    currentContent: string,
    analysis: NoteAnalysis,
    settings: SearchSettings
  ): Promise<CandidateNote[]> {
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path !== currentFile.path)
      .filter(
        (f) =>
          !settings.excludeFolders.some((folder) => f.path.startsWith(folder))
      );

    const candidates: CandidateNote[] = [];

    for (const file of files) {
      const result = await this.scoreFile(
        file,
        currentContent,
        analysis
      );
      if (result.score >= settings.minMatchScore) {
        candidates.push(result);
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  private async scoreFile(
    file: TFile,
    currentContent: string,
    analysis: NoteAnalysis
  ): Promise<CandidateNote> {
    let score = 0;
    let matchLevel: 1 | 2 | 3 = 3;
    const matchReasons: string[] = [];

    const allNames = [file.basename, ...this.getAliases(file)];

    // Level 1: title or alias appears verbatim in the current note
    for (const name of allNames) {
      if (name.length >= 2 && currentContent.includes(name)) {
        score += 100;
        matchLevel = 1;
        matchReasons.push(`제목/별칭 "${name}" 텍스트 일치`);
        break;
      }
    }

    if (matchLevel > 1) {
      // Level 2: keyword overlap (TF-IDF style)
      const fileContent = await this.app.vault.cachedRead(file);
      const fileKeywords = this.analyzer.extractKeywords(
        this.analyzer.stripMarkdown(fileContent)
      );

      let overlap = 0;
      let totalWeight = 0;

      for (const [kw, freq] of analysis.keywords) {
        if (kw.length < 2) continue;
        const weight = Math.log(freq + 1) + 1;
        totalWeight += weight;
        if (fileKeywords.has(kw)) {
          overlap += weight * Math.min(Math.log(fileKeywords.get(kw)! + 1) + 1, 3);
        }
      }

      const keywordScore = totalWeight > 0 ? (overlap / totalWeight) * 80 : 0;

      if (keywordScore >= 15) {
        score += keywordScore;
        matchLevel = 2;
        matchReasons.push(`키워드 유사도 ${Math.round(keywordScore)}점`);
      }
    }

    // Level 3 bonus: shared tags
    const cache = this.app.metadataCache.getFileCache(file);
    const fileTags = cache?.tags?.map((t) => t.tag.replace("#", "")) ?? [];
    const tagOverlap = fileTags.filter((t) => analysis.tags.includes(t)).length;
    if (tagOverlap > 0) {
      score += tagOverlap * 15;
      matchLevel = Math.min(matchLevel, 3) as 1 | 2 | 3;
      matchReasons.push(`태그 ${tagOverlap}개 일치`);
    }

    // Level 3 bonus: heading keyword overlap
    for (const heading of analysis.headings) {
      const headingWords = heading.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) ?? [];
      for (const word of headingWords) {
        const needle = word.toLowerCase();
        if (
          file.basename.toLowerCase().includes(needle) ||
          fileTags.some((t) => t.toLowerCase().includes(needle))
        ) {
          score += 10;
          matchReasons.push(`헤딩 "${heading}" 참조 가능`);
          break;
        }
      }
    }

    return { file, score, matchLevel, matchReasons };
  }

  private getAliases(file: TFile): string[] {
    const cache = this.app.metadataCache.getFileCache(file);
    const raw =
      cache?.frontmatter?.aliases ?? cache?.frontmatter?.alias ?? [];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") return [raw];
    return [];
  }
}
