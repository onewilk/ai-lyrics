/** 关键词解析项。 */
export interface Keyword {
  /** 原词（源语言）。 */
  word: string;
  /** 读音/注音（如日文假名、中文拼音、英文音标），可选。 */
  reading?: string;
  /** 中文释义。 */
  meaning: string;
  /** 词性，可选（如 n./v./adj.）。 */
  pos?: string;
}

/** 例句（源语言 + 中文）。 */
export interface Example {
  src: string;
  zh: string;
}

/** 单行歌词的 AI 解析结果。 */
export interface LineAnalysis {
  /** 中文翻译。 */
  translation: string;
  /** 识别出的源语言（如 "English"、"日本語"），可选。 */
  language?: string;
  keywords: Keyword[];
  examples: Example[];
  /** 语法/句式要点（时态、从句、倒装、固定搭配、省略等），一句话，可选。 */
  grammar?: string;
}

/** 解析输入。 */
export interface AnalyzeInput {
  /** 当前行文本。 */
  line: string;
  /** 上下文（前后若干行），帮助翻译更准确，可选。 */
  context?: string[];
  /** 目标语言，默认中文。 */
  targetLang?: string;
  trackTitle?: string;
  artist?: string;
  /** 所属歌曲标识（缓存按歌曲隔离）。 */
  songId?: string;
}

/** 批量解析的上下文。 */
export interface BatchAnalyzeContext {
  targetLang?: string;
  trackTitle?: string;
  artist?: string;
  /** 整首歌词（仅供模型理解语境，不翻译），提升上下文准确度。 */
  contextLines?: string[];
}

/** AI 能力提供方。可插拔：本地 Ollama / OpenAI 兼容云端。 */
export interface AiProvider {
  readonly id: string;
  /** 解析单行。 */
  analyzeLine(input: AnalyzeInput, signal?: AbortSignal): Promise<LineAnalysis>;
  /**
   * 一次解析多行（连续片段），返回与输入等长、同序的结果数组。
   * 若提供 onLine，则在（流式）解析过程中每完成一行即回调（sliceIndex 为该行在 lines 中的下标）。
   */
  analyzeLines(
    lines: string[],
    ctx: BatchAnalyzeContext,
    signal?: AbortSignal,
    onLine?: (sliceIndex: number, analysis: LineAnalysis) => void,
  ): Promise<LineAnalysis[]>;
}
