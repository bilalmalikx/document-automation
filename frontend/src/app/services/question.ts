import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { QuestionTurn } from '../core/models/question.model';
import { Answer } from '../core/models/answer.model';

export interface QAPair {
  question: QuestionTurn;
  answer: Answer;
}

@Injectable({
  providedIn: 'root'
})
export class QuestionService {
  private historySubject = new BehaviorSubject<QAPair[]>([]);
  history$ = this.historySubject.asObservable();
  
  private currentAnswerSubject = new BehaviorSubject<Answer | null>(null);
  currentAnswer$ = this.currentAnswerSubject.asObservable();
  
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();
  
  private questionCountSubject = new BehaviorSubject<number>(0);
  questionCount$ = this.questionCountSubject.asObservable();
  
  private confidenceScoresSubject = new BehaviorSubject<number[]>([]);
  confidenceScores$ = this.confidenceScoresSubject.asObservable();

  constructor() {}

  // Add a new Q&A to history
  addToHistory(question: string, answer: Answer): void {
    const qaPair: QAPair = {
      question: new QuestionTurn(question),
      answer: answer
    };
    
    const current = this.historySubject.value;
    this.historySubject.next([qaPair, ...current]);
    
    // Update counts
    this.questionCountSubject.next(this.questionCountSubject.value + 1);
    
    // Track confidence
    const scores = this.confidenceScoresSubject.value;
    this.confidenceScoresSubject.next([...scores, answer.confidence]);
  }

  // Set current answer (for display)
  setCurrentAnswer(answer: Answer | null): void {
    this.currentAnswerSubject.next(answer);
  }

  // Set loading state
  setLoading(loading: boolean): void {
    this.isLoadingSubject.next(loading);
  }

  // Get average confidence
  getAverageConfidence(): number {
    const scores = this.confidenceScoresSubject.value;
    if (scores.length === 0) return 0;
    const sum = scores.reduce((a, b) => a + b, 0);
    return sum / scores.length;
  }

  // Clear history
  clearHistory(): void {
    this.historySubject.next([]);
    this.questionCountSubject.next(0);
    this.confidenceScoresSubject.next([]);
    this.currentAnswerSubject.next(null);
  }

  // Get total questions asked
  getTotalQuestions(): number {
    return this.questionCountSubject.value;
  }
}