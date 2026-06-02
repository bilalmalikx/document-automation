import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api';
import { ToastService } from './toast';

export interface PreviewResponse {
  success: boolean;
  mapped_values: Record<string, string>;
  placeholders_found: number;
  total_placeholders: number;
}

@Injectable({ providedIn: 'root' })
export class GenerateService {
  constructor(private api: ApiService, private toast: ToastService) {}

  async preview(instruction: string, templateId: string): Promise<PreviewResponse> {
    try {
      const response = await lastValueFrom(
        this.api.post<PreviewResponse>('/generate/preview', { 
          template_id: templateId, 
          instruction: instruction 
        })
      );
      return response;
    } catch (err: any) {
      this.toast.show('error', 'Preview Failed', err.error?.detail || err.message);
      throw err;
    }
  }

  async generate(instruction: string, templateId: string): Promise<Blob> {
    try {
      const response = await lastValueFrom(
        this.api.postBlob('/generate/', { 
          template_id: templateId, 
          instruction: instruction 
        })
      );
      return response;
    } catch (err: any) {
      this.toast.show('error', 'Generation Failed', err.error?.detail || err.message);
      throw err;
    }
  }

  async bulkGenerate(instruction: string, templateIds: string[]): Promise<Blob> {
    try {
      const response = await lastValueFrom(
        this.api.postBlob('/generate/generate-multiple', { 
          template_ids: templateIds, 
          instruction: instruction 
        })
      );
      return response;
    } catch (err: any) {
      this.toast.show('error', 'Bulk Generation Failed', err.error?.detail || err.message);
      throw err;
    }
  }
}