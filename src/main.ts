import { Editor, MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { NoteAnalyzer } from "./analyzer";
import { NoteSearcher } from "./searcher";
import { LinkMatcher } from "./matcher";
import { LinkSuggestionModal } from "./modal";
import { AutoLinkSettings, LinkSuggestion } from "./types";
import { DEFAULT_SETTINGS, AutoLinkSettingTab } from "./settings";

export default class AutoLinkPlugin extends Plugin {
  settings: AutoLinkSettings;
  private analyzer: NoteAnalyzer;
  private searcher: NoteSearcher;
  private matcher: LinkMatcher;

  async onload() {
    await this.loadSettings();

    this.analyzer = new NoteAnalyzer(this.app);
    this.searcher = new NoteSearcher(this.app);
    this.matcher = new LinkMatcher(this.app);

    this.addCommand({
      id: "find-and-link",
      name: "현재 노트에서 링크 찾기",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        if (view.file) await this.runAutoLink(editor, view.file);
      },
    });

    this.addRibbonIcon("link", "Auto Link: 링크 찾기", async () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) {
        new Notice("열린 노트가 없습니다.");
        return;
      }
      await this.runAutoLink(view.editor, view.file);
    });

    this.addSettingTab(new AutoLinkSettingTab(this.app, this));
  }

  private async runAutoLink(editor: Editor, file: TFile) {
    const notice = new Notice("노트 분석 중…", 0);

    try {
      const content = editor.getValue();

      // 드래그 선택 감지
      const selection = editor.getSelection();
      const hasSelection = selection.trim().length > 0;
      const selectionRange = hasSelection
        ? {
            from: editor.posToOffset(editor.getCursor("from")),
            to: editor.posToOffset(editor.getCursor("to")),
          }
        : undefined;

      if (hasSelection) {
        notice.setMessage("선택 영역 분석 중…");
      }

      // Step 1: 선택 영역이 있으면 그 텍스트만 분석, 없으면 전체 노트
      const cache = this.app.metadataCache.getFileCache(file);
      const analysis = hasSelection
        ? this.analyzer.analyzeContent(selection, cache)
        : await this.analyzer.analyze(file);

      // Step 2: Find candidate notes
      notice.setMessage("관련 노트 탐색 중…");
      const excludeFolders = this.settings.excludeFolders
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const analysisContent = hasSelection ? selection : content;
      const candidates = await this.searcher.findCandidates(
        file,
        analysisContent,
        analysis,
        { minMatchScore: this.settings.minMatchScore, excludeFolders }
      );

      if (candidates.length === 0) {
        notice.hide();
        new Notice(
          hasSelection
            ? "선택 영역과 관련된 노트를 찾지 못했습니다."
            : "연결할 수 있는 관련 노트를 찾지 못했습니다."
        );
        return;
      }

      // Step 3 & 4: 선택 range 내에서만 링크 위치 탐색
      notice.setMessage("링크 위치 매핑 중…");
      const topCandidates = candidates.slice(0, this.settings.maxSuggestions);
      const suggestions = await this.matcher.generateSuggestions(
        content,
        topCandidates,
        selectionRange
      );

      notice.hide();

      if (suggestions.length === 0) {
        new Notice(
          hasSelection
            ? "선택한 텍스트에 연결 가능한 위치를 찾지 못했습니다."
            : "현재 노트 텍스트에 연결 가능한 위치를 찾지 못했습니다."
        );
        return;
      }

      // Step 5: User confirmation
      new LinkSuggestionModal(this.app, suggestions, (selected) => {
        this.applyLinks(editor, selected);
      }).open();
    } catch (err) {
      notice.hide();
      console.error("[AutoLink]", err);
      new Notice("오류가 발생했습니다. 개발자 콘솔을 확인해주세요.");
    }
  }

  private applyLinks(editor: Editor, suggestions: LinkSuggestion[]) {
    if (suggestions.length === 0) return;

    let content = editor.getValue();

    // Group insertions at the same position so they appear as " [[A]] · [[B]]"
    const insertionGroups = new Map<number, string[]>();
    const changes: Array<{ from: number; to: number; text: string }> = [];

    for (const { from, to, text, targetFile, isInsert } of suggestions) {
      if (isInsert) {
        const group = insertionGroups.get(from) ?? [];
        group.push(`[[${targetFile.basename}]]`);
        insertionGroups.set(from, group);
      } else {
        const isExactTitle = text === targetFile.basename;
        const linkText = isExactTitle
          ? `[[${text}]]`
          : `[[${targetFile.basename}|${text}]]`;
        changes.push({ from, to, text: linkText });
      }
    }

    for (const [pos, links] of insertionGroups) {
      // 삽입형은 <small>로 감싸 원문보다 작게 표시
      changes.push({ from: pos, to: pos, text: ` <small>${links.join(" · ")}</small>` });
    }

    // Apply end-to-start to preserve positions
    changes.sort((a, b) => b.from - a.from);
    for (const { from, to, text: replacement } of changes) {
      content = content.slice(0, from) + replacement + content.slice(to);
    }

    editor.setValue(content);
    new Notice(`✓ ${suggestions.length}개의 링크를 적용했습니다.`);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
