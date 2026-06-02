export class QuestionTurn {
  constructor(
    public question: string,
    public timestamp: Date = new Date()
  ) {}
}