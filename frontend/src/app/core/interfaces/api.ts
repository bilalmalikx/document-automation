export interface UploadResponse {
  message: string;
  filename: string;
  pages?: number;
  chunks?: number;
}

export interface QuestionRequest {
  question: string;
  pdf_name?: string;
}

export interface AnswerResponse {
  question: string;
  answer: string;
  source_chunks: string[];
  confidence: number;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

export interface DocumentInfo {
  name: string;
  pages?: number;
  chunks?: number;
  uploadDate?: Date;
}