import { App, Modal } from "obsidian";
import { LinkSuggestion } from "./types";

type ConfirmCallback = (selected: LinkSuggestion[]) => void;

export class LinkSuggestionModal extends Modal {
  private selected: Set<number>;

  constructor(
    app: App,
    private suggestions: LinkSuggestion[],
    private onConfirm: ConfirmCallback
  ) {
    super(app);
    this.selected = new Set(suggestions.map((_, i) => i));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("autolink-modal");

    contentEl.createEl("h2", { text: "자동 링크 제안" });
    contentEl.createEl("p", {
      text: `${this.suggestions.length}개의 링크 후보를 찾았습니다. 연결할 항목을 선택하세요.`,
      cls: "autolink-subtitle",
    });

    if (this.suggestions.length === 0) {
      contentEl.createEl("p", { text: "연결할 수 있는 링크가 없습니다." });
      this.renderButtons(contentEl);
      return;
    }

    this.renderGroups(contentEl);
    this.renderButtons(contentEl);
  }

  private renderGroups(container: HTMLElement) {
    const exact: Array<{ s: LinkSuggestion; i: number }> = [];
    const semantic: Array<{ s: LinkSuggestion; i: number }> = [];

    this.suggestions.forEach((s, i) => {
      if (s.matchType === "title" || s.matchType === "alias") {
        exact.push({ s, i });
      } else {
        semantic.push({ s, i });
      }
    });

    if (exact.length > 0) {
      this.renderSection(container, "정확한 텍스트 일치", exact);
    }
    if (semantic.length > 0) {
      this.renderSection(container, "맥락 기반 연결 후보", semantic);
    }
  }

  private renderSection(
    container: HTMLElement,
    title: string,
    items: Array<{ s: LinkSuggestion; i: number }>
  ) {
    const section = container.createDiv({ cls: "autolink-section" });
    section.createEl("h3", { text: title, cls: "autolink-section-title" });
    for (const { s, i } of items) {
      this.renderItem(section, s, i);
    }
  }

  private renderItem(container: HTMLElement, s: LinkSuggestion, index: number) {
    const item = container.createDiv({ cls: "autolink-item" });

    const checkbox = item.createEl("input", { type: "checkbox" });
    checkbox.checked = this.selected.has(index);
    checkbox.dataset.index = String(index);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) this.selected.add(index);
      else this.selected.delete(index);
    });

    const info = item.createDiv({ cls: "autolink-item-info" });
    const matchLine = info.createDiv({ cls: "autolink-match" });

    // 교체형/삽입형 모두 원문 미리보기를 작게 표시
    const preview = s.text.length > 40 ? s.text.slice(0, 40) + "…" : s.text;
    matchLine.createSpan({ text: preview, cls: "autolink-sentence-preview" });
    matchLine.createSpan({ text: s.isInsert ? "  +  " : "  →  ", cls: "autolink-quote" });
    matchLine.createSpan({ text: `[[${s.targetFile.basename}]]`, cls: "autolink-target" });

    const metaLine = info.createDiv({ cls: "autolink-meta" });
    const badgeLabels: Record<string, string> = {
      title: "제목 일치",
      alias: "별칭 일치",
      keyword: "키워드",
      context: "맥락 삽입",
    };
    metaLine.createSpan({
      text: badgeLabels[s.matchType] ?? s.matchType,
      cls: `autolink-badge autolink-badge-${s.matchType}`,
    });
    metaLine.createSpan({
      text: `점수: ${Math.round(s.score)}`,
      cls: "autolink-score",
    });

    // 맥락 삽입의 경우 일치한 키워드 전부 표시
    if (s.isInsert && s.matchKeywords && s.matchKeywords.length > 0) {
      const kwLine = info.createDiv({ cls: "autolink-keywords-line" });
      kwLine.createSpan({ text: "근거: ", cls: "autolink-keywords-label" });
      for (const kw of s.matchKeywords) {
        kwLine.createSpan({ text: kw, cls: "autolink-keyword-chip" });
      }
    }
  }

  private renderButtons(container: HTMLElement) {
    const row = container.createDiv({ cls: "autolink-buttons" });

    if (this.suggestions.length > 0) {
      const selectAll = row.createEl("button", { text: "전체 선택" });
      selectAll.addEventListener("click", () => {
        this.suggestions.forEach((_, i) => this.selected.add(i));
        this.syncCheckboxes();
      });

      const deselectAll = row.createEl("button", { text: "전체 해제" });
      deselectAll.addEventListener("click", () => {
        this.selected.clear();
        this.syncCheckboxes();
      });
    }

    const confirm = row.createEl("button", {
      text: "링크 적용",
      cls: "mod-cta",
    });
    confirm.addEventListener("click", () => {
      const selected = this.suggestions.filter((_, i) => this.selected.has(i));
      this.onConfirm(selected);
      this.close();
    });

    const cancel = row.createEl("button", { text: "취소" });
    cancel.addEventListener("click", () => this.close());
  }

  private syncCheckboxes() {
    this.contentEl
      .querySelectorAll<HTMLInputElement>("input[type='checkbox']")
      .forEach((cb) => {
        const idx = parseInt(cb.dataset.index ?? "-1");
        if (idx >= 0) cb.checked = this.selected.has(idx);
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
