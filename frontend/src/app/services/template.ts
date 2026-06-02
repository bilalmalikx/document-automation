import { Injectable, signal } from '@angular/core';
import { ApiService } from './api';
import { ToastService } from './toast';

export interface Template {
  id: string;
  filename: string;
  original_filename: string;
  placeholders: string[];
  placeholder_count: number;
  created_at: string;
  updated_at?: string;
}

export interface TemplateListResponse {
  templates: Template[];
  total: number;
}

export interface PlaceholdersResponse {
  template_id: string;
  placeholders: string[];
  count: number;
}

@Injectable({ providedIn: 'root' })
export class TemplateService {
  templates = signal<Template[]>([]);
  loading = signal(false);
  selectedTemplates = signal<Template[]>([]);

  constructor(private api: ApiService, private toast: ToastService) {}

  loadTemplates(): void {
    this.loading.set(true);
    this.api.get<TemplateListResponse>('/templates/').subscribe({
      next: (res) => {
        this.templates.set(res.templates || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Load templates error:', err);
        this.templates.set([]);
        this.loading.set(false);
        this.toast.show('error', 'Error', 'Failed to load templates');
      }
    });
  }

  uploadTemplate(name: string, file: File): Promise<Template> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      if (name) {
        formData.append('name', name);
      }

      console.log('Uploading:', name, file.name);
      
      this.api.postFormData<Template>('/templates/upload', formData).subscribe({
        next: (res) => {
          console.log('Upload response:', res);
          this.templates.update(t => [res, ...t]);
          this.toast.show('success', 'Uploaded!', `${name || file.name} uploaded successfully`);
          resolve(res);
        },
        error: (err) => {
          console.error('Upload error details:', err);
          let errorMsg = 'Upload failed';
          if (err.error?.detail) errorMsg = err.error.detail;
          else if (err.message) errorMsg = err.message;
          this.toast.show('error', 'Upload Failed', errorMsg);
          reject(new Error(errorMsg));
        }
      });
    });
  }

  getPlaceholders(id: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.api.get<PlaceholdersResponse>(`/templates/${id}/placeholders`).subscribe({
        next: (res) => resolve(res.placeholders || []),
        error: (err) => {
          console.error('Get placeholders error:', err);
          reject(err);
        }
      });
    });
  }

  deleteTemplate(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.delete(`/templates/${id}`).subscribe({
        next: () => {
          this.templates.update(t => t.filter(tm => tm.id !== id));
          const currentSelected = this.selectedTemplates();
          this.selectedTemplates.set(currentSelected.filter(t => t.id !== id));
          this.toast.show('success', 'Deleted', 'Template removed');
          resolve();
        },
        error: (err) => {
          console.error('Delete error:', err);
          reject(err);
        }
      });
    });
  }

  getTemplate(id: string): Template | undefined {
    return this.templates().find(t => t.id === id);
  }

  toggleSelection(template: Template): void {
    const current = this.selectedTemplates();
    const index = current.findIndex(t => t.id === template.id);
    
    if (index === -1) {
      this.selectedTemplates.set([...current, template]);
    } else {
      this.selectedTemplates.set(current.filter(t => t.id !== template.id));
    }
  }
  
  isSelected(templateId: string): boolean {
    return this.selectedTemplates().some(t => t.id === templateId);
  }
  
  clearSelection(): void {
    this.selectedTemplates.set([]);
  }
  
  getSelectedIds(): string[] {
    return this.selectedTemplates().map(t => t.id);
  }
  
  getSelectedCount(): number {
    return this.selectedTemplates().length;
  }
  
  hasSelection(): boolean {
    return this.selectedTemplates().length > 0;
  }
  
  isMultipleSelected(): boolean {
    return this.selectedTemplates().length > 1;
  }
  
  getFirstSelected(): Template | null {
    const selected = this.selectedTemplates();
    return selected.length > 0 ? selected[0] : null;
  }
}