import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Answer } from '../../core/models/answer.model';
import { SafeHtmlPipe } from '../shared/pipes/safe-html-pipe';

@Component({
  selector: 'app-answer-display',
  imports: [CommonModule, SafeHtmlPipe],
  templateUrl: './answer-display.html',
  styleUrls: ['./answer-display.css']
})
export class AnswerDisplayComponent {
  @Input() currentAnswer: Answer | null = null;
  @Input() history: any[] = [];

  trackByIndex(index: number): number {
    return index;
  }
  
  trackByQuestion(index: number, turn: any): string {
    return turn.question.question + turn.answer.timestamp;
  }
  
  // Helper method to truncate long source text
  getShortText(source: string): string {
    if (!source) return '';
    if (source.length <= 150) return source;
    return source.substring(0, 147) + '...';
  }
}