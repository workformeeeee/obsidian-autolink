import { App, PluginSettingTab, Setting } from "obsidian";
import { AutoLinkSettings } from "./types";
import AutoLinkPlugin from "./main";

export const DEFAULT_SETTINGS: AutoLinkSettings = {
  minMatchScore: 20,
  maxSuggestions: 50,
  excludeFolders: "",
  caseSensitive: false,
};

export class AutoLinkSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AutoLinkPlugin) {
    super(app, plugin);
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Auto Link 설정" });

    new Setting(containerEl)
      .setName("최소 매칭 점수")
      .setDesc("이 점수 이상인 노트만 후보로 표시합니다 (0~100)")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(this.plugin.settings.minMatchScore)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.minMatchScore = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("최대 제안 수")
      .setDesc("한 번에 표시할 최대 링크 제안 수")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maxSuggestions))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.maxSuggestions = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("제외 폴더")
      .setDesc("검색에서 제외할 폴더 경로 (쉼표로 구분, 예: Templates, Archive)")
      .addText((text) =>
        text
          .setPlaceholder("Templates, Archive")
          .setValue(this.plugin.settings.excludeFolders)
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
