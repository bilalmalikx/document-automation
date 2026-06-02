export interface PreviewRequest {
  template_id: string;
  instruction: string;
}

export interface PreviewResponse {
  success: boolean;
  mapped_values: Record<string, string>;
  placeholders_found: number;
  total_placeholders: number;
}

export interface GenerateRequest {
  template_id: string;
  instruction: string;
}

export interface GenerateResponse {
  success: boolean;
  document_id: string;
  download_url: string;
  message: string;
}