export interface Template {
  id: string;
  filename: string;
  original_filename: string;
  placeholders: string[];
  placeholder_count: number;
  created_at: string;
  updated_at?: string;
}

export interface TemplateUploadResponse extends Template {}

export interface TemplateListResponse {
  templates: Template[];
  total: number;
}

export interface PlaceholdersResponse {
  template_id: string;
  placeholders: string[];
  count: number;
}