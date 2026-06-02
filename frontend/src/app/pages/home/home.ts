import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime } from 'rxjs';

import { Document } from '../../core/models/document.model';
import { Answer } from '../../core/models/answer.model';
import { FileUploadComponent } from '../../components/file-upload/file-upload';
import { QuestionInputComponent } from '../../components/question-input/question-input';
import { AnswerDisplayComponent } from '../../components/answer-display/answer-display';
import { StatsCardComponent } from '../../components/stats-card/stats-card';
import { ApiService } from '../../services/api';
import { DocumentService } from '../../services/document';
import { QuestionService } from '../../services/question';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    FileUploadComponent,
    QuestionInputComponent,
    AnswerDisplayComponent,
    StatsCardComponent   
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('questionInput') questionInput!: ElementRef<HTMLTextAreaElement>;
  
  documents: Document[] = [];
  selectedDocumentIds: Set<string> = new Set();  // ✅ Track selected PDFs
  selectedDocument: Document | null = null;  // Keep for backward compatibility
  currentAnswer: Answer | null = null;
  history: any[] = [];
  isLoading = false;
  uploadProgress = 0;
  isUploading = false;
  uploadError: string | null = null;
  qaError: string | null = null;
  
  questionText = '';
  hints = [
    'Summarize the document',
    'What are the main conclusions?',
    'List key statistics mentioned',
    'Who are the authors?'
  ];
  
  stats = {
    documents: 0,
    questions: 0,
    avgConfidence: 0
  };
  
  getSelectedCount(): number {
    return this.selectedDocumentIds.size;
  }
  
  getSelectedNames(): string {
    const names = Array.from(this.selectedDocumentIds);
    if (names.length === 0) return 'No document selected';
    if (names.length === 1) return names[0];
    return `${names.length} documents selected`;
  }
  
  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private documentService: DocumentService,
    private questionService: QuestionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.documentService.documents$
      .pipe(takeUntil(this.destroy$))
      .subscribe(docs => {
        this.documents = docs;
        this.stats.documents = docs.length;
        this.cdr.detectChanges();
      });
    
    this.documentService.selectedDocument$
      .pipe(takeUntil(this.destroy$))
      .subscribe(doc => {
        this.selectedDocument = doc;
        this.cdr.detectChanges();
      });
    
    this.questionService.currentAnswer$
      .pipe(takeUntil(this.destroy$))
      .subscribe(answer => {
        this.currentAnswer = answer;
        this.cdr.detectChanges();
      });
    
    this.questionService.history$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => {
        this.history = history;
        this.cdr.detectChanges();
      });
    
    this.questionService.isLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
        this.cdr.detectChanges();
      });
    
    this.documentService.uploadProgress$
      .pipe(takeUntil(this.destroy$), debounceTime(50))
      .subscribe(progress => {
        this.uploadProgress = progress;
        this.cdr.detectChanges();
      });
    
    this.questionService.questionCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.stats.questions = count;
        this.updateAvgConfidence();
        this.cdr.detectChanges();
      });
    
    this.questionService.confidenceScores$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateAvgConfidence();
        this.cdr.detectChanges();
      });
    
    this.checkHealth();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateAvgConfidence(): void {
    this.stats.avgConfidence = Math.round(this.questionService.getAverageConfidence() * 100);
  }

  checkHealth(): void {
    this.apiService.checkHealth().subscribe({
      next: () => console.log('Backend healthy'),
      error: (err) => console.warn('Backend not responding:', err.message)
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.uploadFile(input.files[0]);
    }
  }

  onFileDropped(file: File): void {
    this.uploadFile(file);
  }

  uploadFile(file: File): void {
    if (!file.name.endsWith('.pdf')) {
      this.showUploadError('Only PDF files are supported.');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      this.showUploadError('File too large. Maximum size is 50MB.');
      return;
    }
    
    this.isUploading = true;
    this.uploadError = null;
    this.documentService.resetUploadProgress();
    
    this.animateProgress(0, 30, 400);
    
    this.apiService.uploadPDF(file).subscribe({
      next: (response) => {
        this.animateProgress(70, 100, 500);
        
        setTimeout(() => {
          const document = new Document(
            response.filename,
            response.pages,
            response.chunks
          );
          this.documentService.addDocument(document);
          this.isUploading = false;
          this.documentService.resetUploadProgress();
          this.cdr.detectChanges();
        }, 500);
      },
      error: (err) => {
        this.isUploading = false;
        this.documentService.resetUploadProgress();
        this.showUploadError(err.message);
        this.cdr.detectChanges();
      }
    });
  }

  animateProgress(from: number, to: number, duration: number): void {
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const value = Math.round(from + (to - from) * t);
      this.documentService.setUploadProgress(value);
      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  showUploadError(message: string): void {
    this.uploadError = message;
    setTimeout(() => {
      this.uploadError = null;
      this.cdr.detectChanges();
    }, 5000);
  }

  // ✅ DELETE DOCUMENT FUNCTION
  deleteDocument(document: Document, event: Event): void {
    event.stopPropagation();
    
    if (confirm(`Are you sure you want to delete "${document.name}"?`)) {
      this.documentService.removeDocument(document.name);
      
      // Remove from selected set if present
      if (this.selectedDocumentIds.has(document.name)) {
        this.selectedDocumentIds.delete(document.name);
      }
      
      // Clear current answer if deleted document was selected
      if (this.selectedDocument?.name === document.name) {
        this.currentAnswer = null;
        this.questionService.setCurrentAnswer(null);
      }
      
      this.cdr.detectChanges();
    }
  }

  // ✅ TOGGLE DOCUMENT SELECTION
  toggleDocument(document: Document, event: Event): void {
    event.stopPropagation();
    if (this.selectedDocumentIds.has(document.name)) {
      this.selectedDocumentIds.delete(document.name);
    } else {
      this.selectedDocumentIds.add(document.name);
    }
    this.cdr.detectChanges();
  }

  // ✅ SELECT ALL DOCUMENTS
  selectAllDocuments(): void {
    this.documents.forEach(doc => this.selectedDocumentIds.add(doc.name));
    this.cdr.detectChanges();
  }

  // ✅ CLEAR ALL SELECTIONS
  clearSelection(): void {
    this.selectedDocumentIds.clear();
    this.cdr.detectChanges();
  }

  // ✅ ASK QUESTION ON SELECTED DOCUMENTS
  askQuestion(): void {
    if (!this.questionText.trim()) return;
    
    if (this.selectedDocumentIds.size === 0 && this.documents.length === 0) {
      this.showQAError('Please upload and select at least one document.');
      return;
    }
    
    this.qaError = null;
    this.questionService.setLoading(true);
    this.cdr.detectChanges();
    
    const pdf_names = Array.from(this.selectedDocumentIds);
    
    const request = {
      question: this.questionText.trim(),
      pdf_names: pdf_names  // ✅ Send all selected PDF names
    };
    
    this.apiService.askQuestionMultiple(request).subscribe({
      next: (response) => {
        const answer = new Answer(
          response.question,
          response.answer,
          response.confidence,
          response.source_chunks || []
        );
        
        this.questionService.addToHistory(this.questionText, answer);
        this.questionService.setCurrentAnswer(answer);
        this.questionService.setLoading(false);
        
        this.questionText = '';
        this.resetTextareaHeight();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.questionService.setLoading(false);
        this.showQAError(err.message);
        this.cdr.detectChanges();
      }
    });
  }

  showQAError(message: string): void {
    this.qaError = message;
    setTimeout(() => {
      this.qaError = null;
      this.cdr.detectChanges();
    }, 5000);
  }

  selectDocument(document: Document): void {
    this.documentService.selectDocument(document);
    this.cdr.detectChanges();
  }

  fillHint(hint: string): void {
    this.questionText = hint;
    this.focusTextarea();
  }

  focusTextarea(): void {
    setTimeout(() => {
      this.questionInput?.nativeElement.focus();
    });
  }

  resetTextareaHeight(): void {
    setTimeout(() => {
      if (this.questionInput) {
        this.questionInput.nativeElement.style.height = 'auto';
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.askQuestion();
    }
  }

  autoResizeTextarea(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }

  trackByFilename(index: number, doc: Document): string {
    return doc.name;
  }
}