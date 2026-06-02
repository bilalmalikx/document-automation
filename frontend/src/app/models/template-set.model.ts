export interface TemplateSet {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface TemplateSetDetails extends TemplateSet {
  templates: TemplateSetTemplate[];
  shared_fields: SharedField[];
  total_templates: number;
  total_shared_fields: number;
  unique_placeholders: string[];
}

export interface TemplateSetTemplate {
  id: string;
  filename: string;
  original_filename: string;
  placeholders: string[];
  placeholder_count: number;
  created_at: string;
}

export interface SharedField {
  id: string;
  template_set_id: string;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'date' | 'number' | 'email' | 'textarea';
  field_order: number;
  is_required: boolean;
  default_value?: string;
  created_at: string;
}

export interface CreateTemplateSetRequest {
  name: string;
  description?: string;
}

export interface UpdateTemplateSetRequest {
  name?: string;
  description?: string;
}

export interface AddTemplateToSetRequest {
  template_id: string;
  order_index?: number;
}

export interface CreateSharedFieldRequest {
  field_name: string;
  field_label: string;
  field_type?: string;
  field_order?: number;
  is_required?: boolean;
  default_value?: string;
}

export interface GenerateSetRequest {
  instruction: string;
}