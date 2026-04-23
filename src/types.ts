import { TFile } from "obsidian";

export interface NoteAnalysis {
  keywords: Map<string, number>;
  headings: string[];
  tags: string[];
  frontmatter: Record<string, unknown>;
  sentences: string[];
}

export interface CandidateNote {
  file: TFile;
  score: number;
  matchLevel: 1 | 2 | 3;
  matchReasons: string[];
}

export interface LinkSuggestion {
  text: string;
  from: number;
  to: number;
  targetFile: TFile;
  matchType: "title" | "alias" | "keyword" | "context";
  score: number;
  isInsert?: boolean;       // true = 문장 끝에 [[Note]] 삽입, false = 텍스트 치환
  matchKeywords?: string[]; // 맥락 삽입 시 일치한 키워드 목록
}

export interface AutoLinkSettings {
  minMatchScore: number;
  maxSuggestions: number;
  excludeFolders: string;
  caseSensitive: boolean;
}
