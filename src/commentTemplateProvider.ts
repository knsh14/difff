import * as vscode from "vscode";
import { CommentService, DiffComment } from "./commentService";

export interface CommentTemplate {
  id: string;
  name: string;
  template: string;
  isActive: boolean;
}

export class CommentTemplateItem extends vscode.TreeItem {
  constructor(
    public readonly template: CommentTemplate,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(template.name, collapsibleState);
    this.tooltip = template.template;
    this.contextValue = "template";
    this.iconPath = template.isActive
      ? new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"))
      : new vscode.ThemeIcon("circle-outline");
  }
}

export class CommentTemplateProvider
  implements vscode.TreeDataProvider<CommentTemplateItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    CommentTemplateItem | undefined | null | void
  > = new vscode.EventEmitter<CommentTemplateItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    CommentTemplateItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private readonly storageKey = "difff.commentTemplates";
  private readonly activeTemplateKey = "difff.activeCommentTemplate";

  constructor(
    private context: vscode.ExtensionContext,
    private commentService: CommentService,
  ) {
    this.initializeDefaultTemplates();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommentTemplateItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommentTemplateItem): Thenable<CommentTemplateItem[]> {
    if (!element) {
      const templates = this.getTemplates();
      return Promise.resolve(
        templates.map(
          (template) =>
            new CommentTemplateItem(
              template,
              vscode.TreeItemCollapsibleState.None,
            ),
        ),
      );
    }
    return Promise.resolve([]);
  }

  private initializeDefaultTemplates(): void {
    const existingTemplates = this.getTemplates();
    if (existingTemplates.length === 0) {
      const defaultTemplates: CommentTemplate[] = [
        {
          id: "simple",
          name: "Simple Format",
          template: "@{{filePath}} L{{lineNumber}}: {{content}}",
          isActive: true,
        },
        {
          id: "markdown",
          name: "Markdown Format",
          template:
            "- **File**: `{{filePath}}`\n  - **Line {{lineNumber}}**: {{content}}",
          isActive: false,
        },
        {
          id: "github",
          name: "GitHub Review Format",
          template:
            "```suggestion\n{{filePath}}:{{lineNumber}} - {{content}}\n```",
          isActive: false,
        },
        {
          id: "jira",
          name: "JIRA Format",
          template:
            "{code:title={{filePath}}|line={{lineNumber}}}\n{{content}}\n{code}",
          isActive: false,
        },
        {
          id: "detailed",
          name: "Detailed Format",
          template:
            "File: {{filePath}}\nLine: {{lineNumber}} ({{lineType}})\nAuthor: {{author}}\nTime: {{timestamp}}\nComment: {{content}}\n---",
          isActive: false,
        },
      ];

      this.saveTemplates(defaultTemplates);
      this.setActiveTemplate("simple");
    }
  }

  getTemplates(): CommentTemplate[] {
    const stored = this.context.globalState.get<CommentTemplate[]>(
      this.storageKey,
    );
    return stored || [];
  }

  private saveTemplates(templates: CommentTemplate[]): void {
    this.context.globalState.update(this.storageKey, templates);
  }

  addTemplate(name: string, template: string): void {
    const templates = this.getTemplates();
    const newTemplate: CommentTemplate = {
      id: `custom_${Date.now()}`,
      name,
      template,
      isActive: false,
    };
    templates.push(newTemplate);
    this.saveTemplates(templates);
    this.refresh();
  }

  editTemplate(id: string, name: string, template: string): void {
    const templates = this.getTemplates();
    const index = templates.findIndex((t) => t.id === id);
    if (index !== -1) {
      templates[index].name = name;
      templates[index].template = template;
      this.saveTemplates(templates);
      this.refresh();
    }
  }

  deleteTemplate(id: string): void {
    const templates = this.getTemplates();
    const filtered = templates.filter((t) => t.id !== id);
    if (filtered.length < templates.length) {
      this.saveTemplates(filtered);
      this.refresh();
    }
  }

  setActiveTemplate(id: string): void {
    const templates = this.getTemplates();
    templates.forEach((t) => {
      t.isActive = t.id === id;
    });
    this.saveTemplates(templates);
    this.context.globalState.update(this.activeTemplateKey, id);
    this.refresh();
  }

  getActiveTemplate(): CommentTemplate | undefined {
    const templates = this.getTemplates();
    return templates.find((t) => t.isActive);
  }

  formatComment(comment: DiffComment): string {
    const template = this.getActiveTemplate();
    if (!template) {
      return `@${comment.filePath} ${comment.lineNumber} ${comment.content}`;
    }

    let formatted = template.template;
    const replacements: { [key: string]: string } = {
      filePath: comment.filePath,
      lineNumber: comment.lineNumber.toString(),
      lineType: comment.lineType,
      content: comment.content,
      author: comment.author,
      timestamp: new Date(comment.timestamp).toLocaleString(),
      baseRef: comment.baseRef || "",
      compareRef: comment.compareRef || "",
    };

    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      formatted = formatted.replace(regex, value);
    });

    return formatted;
  }

  copyCommentsWithTemplate(baseRef?: string, compareRef?: string): string {
    const allComments = this.commentService.getAllComments();
    const filteredComments = allComments.filter(
      (comment) =>
        comment.baseRef === baseRef && comment.compareRef === compareRef,
    );

    if (filteredComments.length === 0) {
      return "";
    }

    filteredComments.sort((a, b) => {
      if (a.filePath !== b.filePath) {
        return a.filePath.localeCompare(b.filePath);
      }
      return a.lineNumber - b.lineNumber;
    });

    const formattedComments = filteredComments.map((comment) =>
      this.formatComment(comment),
    );

    return formattedComments.join("\n\n");
  }

  async showTemplateQuickPick(): Promise<void> {
    const templates = this.getTemplates();
    const items = templates.map((t) => ({
      label: t.isActive ? `$(check) ${t.name}` : t.name,
      description: t.template.substring(0, 60) + "...",
      template: t,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a template to activate",
    });

    if (selected) {
      this.setActiveTemplate(selected.template.id);
      vscode.window.showInformationMessage(
        `Template "${selected.template.name}" is now active`,
      );
    }
  }

  async createNewTemplate(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: "Enter template name",
      placeHolder: "My Custom Template",
    });

    if (!name) return;

    const template = await vscode.window.showInputBox({
      prompt: "Enter template format",
      placeHolder:
        "Use {{filePath}}, {{lineNumber}}, {{content}}, {{author}}, {{timestamp}}, {{lineType}}",
      value: "{{filePath}}:{{lineNumber}} - {{content}}",
      validateInput: (value) => {
        if (!value) return "Template cannot be empty";
        if (!value.includes("{{")) return "Template should contain variables";
        return null;
      },
    });

    if (!template) return;

    this.addTemplate(name, template);
    vscode.window.showInformationMessage(`Template "${name}" created`);
  }
}
