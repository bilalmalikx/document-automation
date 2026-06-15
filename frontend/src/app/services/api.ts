import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { environment } from '../environments/environment';

export interface AnswerResponse {
  question: string;
  answer: string;
  source_chunks: string[];
  confidence: number;
}

export interface QuestionRequest {
  question: string;
  pdf_name?: string;
  pdf_names?: string[];
  session_id?: string;
}

export interface UploadResponse {
  message: string;
  filename: string;
  pages: number;
  chunks: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Default backend URL - change this to your actual backend URL
  private baseUrl = 'http://localhost:8000/api/v1';
  private apiUrl = 'http://localhost:8000/api/v1';
  private timeoutMs = 60000; // 60 seconds timeout

  constructor(private http: HttpClient) {
    console.log('API Service initialized with baseUrl:', this.baseUrl);
  }

  // ============================================
  // Document Automation APIs
  // ============================================
  
  get<T>(path: string): Observable<T> {
    const url = `${this.baseUrl}${path}`;
    console.log('GET request to:', url);
    return this.http.get<T>(url).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }

  post<T>(path: string, body: any): Observable<T> {
    const url = `${this.baseUrl}${path}`;
    console.log('POST request to:', url, body);
    return this.http.post<T>(url, body).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }

  postFormData<T>(path: string, formData: FormData): Observable<T> {
    const url = `${this.baseUrl}${path}`;
    console.log('POST FormData to:', url);
    return this.http.post<T>(url, formData).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }
  
  put<T>(path: string, body: any): Observable<T> {
    const url = `${this.baseUrl}${path}`;
    return this.http.put<T>(url, body).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }

  delete<T>(path: string): Observable<T> {
    const url = `${this.baseUrl}${path}`;
    return this.http.delete<T>(url).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }

  postBlob(path: string, body: any): Observable<Blob> {
    const url = `${this.baseUrl}${path}`;
    return this.http.post(url, body, { responseType: 'blob' }).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }

  // ============================================
  // PDF RAG System APIs
  // ============================================

  uploadPDF(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('Uploading PDF:', file.name, 'Size:', file.size);
    
    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData).pipe(
      timeout(120000), // 2 minutes for upload
      retry(1),
      catchError(this.handleError)
    );
  }

  askQuestion(request: QuestionRequest): Observable<AnswerResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    
    console.log('Asking question (single):', request);
    
    return this.http.post<AnswerResponse>(`${this.apiUrl}/ask`, request, { headers }).pipe(
      timeout(this.timeoutMs),
      retry(1),
      catchError(this.handleError)
    );
  }

  askQuestionMultiple(request: { question: string; pdf_names: string[] }): Observable<AnswerResponse> {
    console.log('Asking question (multiple):', request);
    
    return this.http.post<AnswerResponse>(`${this.apiUrl}/ask`, request).pipe(
      timeout(this.timeoutMs),
      retry(1),
      catchError(this.handleError)
    );
  }

  checkHealth(): Observable<any> {
    console.log('Checking health at:', `${this.apiUrl}/health`);
    return this.http.get(`${this.apiUrl}/health`).pipe(
      timeout(10000),
      catchError((error) => {
        console.error('Health check failed:', error);
        return throwError(() => new Error('Backend server is not running'));
      })
    );
  }

  private handleError(error: HttpErrorResponse | TimeoutError) {
    let errorMessage = 'An unknown error occurred!';
    
    console.error('API Error Details:', error);
    
    if (error instanceof TimeoutError) {
      errorMessage = 'Request timeout. Server might be busy or not responding.';
    } else if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else if (error.status === 0) {
      errorMessage = 'Cannot connect to backend server. Please make sure the backend is running at http://localhost:8000';
    } else if (error.status === 404) {
      errorMessage = `API endpoint not found. Please check if the backend has the correct routes.`;
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please check backend logs.';
    } else if (error.error?.detail) {
      errorMessage = error.error.detail;
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('Final error message:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}