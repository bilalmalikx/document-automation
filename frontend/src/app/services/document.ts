import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Document } from '../core/models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private documentsSubject = new BehaviorSubject<Document[]>([]);
  documents$ = this.documentsSubject.asObservable();
  
  private selectedDocumentSubject = new BehaviorSubject<Document | null>(null);
  selectedDocument$ = this.selectedDocumentSubject.asObservable();
  
  private uploadProgressSubject = new BehaviorSubject<number>(0);
  uploadProgress$ = this.uploadProgressSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  addDocument(document: Document): void {
    const current = this.documentsSubject.value;
    const exists = current.some(d => d.name === document.name);
    
    if (!exists) {
      const updated = [document, ...current];
      this.documentsSubject.next(updated);
      this.saveToStorage(updated);
      
      if (current.length === 0) {
        this.selectDocument(document);
      }
    }
  }

  removeDocument(documentName: string): void {
    const current = this.documentsSubject.value;
    const updated = current.filter(d => d.name !== documentName);
    this.documentsSubject.next(updated);
    this.saveToStorage(updated);
    
    if (this.selectedDocumentSubject.value?.name === documentName) {
      this.selectedDocumentSubject.next(updated.length > 0 ? updated[0] : null);
    }
  }

  selectDocument(document: Document | null): void {
    this.selectedDocumentSubject.next(document);
  }

  setUploadProgress(progress: number): void {
    this.uploadProgressSubject.next(progress);
  }

  resetUploadProgress(): void {
    this.uploadProgressSubject.next(0);
  }

  getDocumentByName(name: string): Document | undefined {
    return this.documentsSubject.value.find(d => d.name === name);
  }

  hasDocument(name: string): boolean {
    return this.documentsSubject.value.some(d => d.name === name);
  }

  clearAll(): void {
    this.documentsSubject.next([]);
    this.selectedDocumentSubject.next(null);
    localStorage.removeItem('documents');
  }

  private saveToStorage(documents: Document[]): void {
    localStorage.setItem('documents', JSON.stringify(documents));
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem('documents');
    if (stored) {
      const docs = JSON.parse(stored);
      const reconstructedDocs = docs.map((doc: any) => new Document(
        doc.name,
        doc.pages,
        doc.chunks,
        new Date(doc.uploadDate)
      ));
      this.documentsSubject.next(reconstructedDocs);
      if (reconstructedDocs.length > 0) {
        this.selectDocument(reconstructedDocs[0]);
      }
    }
  }
}