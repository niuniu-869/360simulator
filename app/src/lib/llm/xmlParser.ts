// 流式 XML 增量解析器
// 从 LLM 流式输出中实时提取各诊断步骤

export const DIAGNOSIS_TAGS = [
  'greeting',
  'investment',
  'brand',
  'surroundings',
  'accounting',
  'conclusion',
  'proposals',
  'verification',
] as const;

export type DiagnosisTag = (typeof DIAGNOSIS_TAGS)[number];

export interface DiagnosisSection {
  tag: DiagnosisTag;
  content: string;
  isComplete: boolean;
}

export class StreamingXMLParser {
  private buffer = '';

  reset(): void {
    this.buffer = '';
  }

  feed(chunk: string): void {
    this.buffer += chunk;
  }

  getSections(): DiagnosisSection[] {
    const sections: DiagnosisSection[] = [];
    const remaining = this.buffer;

    for (const tag of DIAGNOSIS_TAGS) {
      const openTag = `<${tag}>`;
      const closeTag = `</${tag}>`;
      const openIdx = remaining.indexOf(openTag);

      if (openIdx === -1) continue;

      const contentStart = openIdx + openTag.length;
      const closeIdx = remaining.indexOf(closeTag, contentStart);

      if (closeIdx !== -1) {
        // 完整的标签对
        sections.push({
          tag,
          content: remaining.slice(contentStart, closeIdx).trim(),
          isComplete: true,
        });
      } else {
        // 标签已打开但未关闭 → 正在流式输出
        sections.push({
          tag,
          content: remaining.slice(contentStart).trim(),
          isComplete: false,
        });
      }
    }

    return sections;
  }
}
