import { Component, EventEmitter, Output, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-question-input',
  imports: [CommonModule, FormsModule],
  templateUrl: './question-input.html',
  styleUrl: './question-input.css',
})
export class QuestionInputComponent {
  @ViewChild('questionInput') questionInputRef!: ElementRef<HTMLTextAreaElement>;
  
  @Input() questionText = '';
  @Input() isLoading = false;
  @Input() qaError: string | null = null;
  @Input() placeholder = 'e.g. What are the key findings in section 3?';
  @Input() hints: string[] = [];
  
  @Output() questionTextChange = new EventEmitter<string>();
  @Output() onAsk = new EventEmitter<void>();
  @Output() onInput = new EventEmitter<Event>();
  @Output() onKeydown = new EventEmitter<KeyboardEvent>();
  @Output() onHintClick = new EventEmitter<string>();

  focusTextarea(): void {
    setTimeout(() => {
      this.questionInputRef?.nativeElement.focus();
    });
  }
}
