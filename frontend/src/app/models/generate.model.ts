export interface GenerateRequest {
  template_id: string;
  instruction: string;
}

export interface PreviewResponse {
  success: boolean;
  mapped_values: Record<string, string>;
  placeholders_found: number;
  total_placeholders: number;
}