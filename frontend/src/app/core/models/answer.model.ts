export class Answer {
  constructor(
    public question: string,
    public content: string,
    public confidence: number,
    public sources: string[],
    public timestamp: Date = new Date()
  ) {}

  get confidencePercent(): number {
    return Math.round(this.confidence * 100);
  }

  get hasSources(): boolean {
    return this.sources && this.sources.length > 0;
  }
}