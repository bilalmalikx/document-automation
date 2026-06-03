import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  TemplateSet,
  TemplateSetDetails,
  SharedField,
  CreateTemplateSetRequest,
  UpdateTemplateSetRequest,
  AddTemplateToSetRequest,
  CreateSharedFieldRequest,
  GenerateSetRequest
} from '../models/template-set.model';
import { ApiService } from './api';

@Injectable({ providedIn: 'root' })
export class TemplateSetService {
  private api = inject(ApiService);

  getTemplateSets(): Observable<{ template_sets: TemplateSet[]; total: number }> {
    return this.api.get('/template-sets/');
  }

  getTemplateSet(id: string): Observable<TemplateSetDetails> {
    return this.api.get(`/template-sets/${id}`);
  }

  createTemplateSet(data: CreateTemplateSetRequest): Observable<TemplateSet> {
    return this.api.post('/template-sets/', data);
  }

  updateTemplateSet(id: string, data: UpdateTemplateSetRequest): Observable<TemplateSet> {
    return this.api.put(`/template-sets/${id}`, data);
  }

  deleteTemplateSet(id: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete(`/template-sets/${id}`);
  }

addTemplateToSet(setId: string, data: { template_id: string; order_index?: number }): Observable<any> {
  return this.api.post(`/template-sets/${setId}/templates`, data);
}

  removeTemplateFromSet(setId: string, templateId: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete(`/template-sets/${setId}/templates/${templateId}`);
  }

  getSharedFields(setId: string): Observable<{ shared_fields: SharedField[]; count: number }> {
    return this.api.get(`/template-sets/${setId}/fields`);
  }

  addSharedField(setId: string, data: CreateSharedFieldRequest): Observable<SharedField> {
    return this.api.post(`/template-sets/${setId}/fields`, data);
  }

  updateSharedField(fieldId: string, data: Partial<SharedField>): Observable<SharedField> {
    return this.api.put(`/template-sets/fields/${fieldId}`, data);
  }

  deleteSharedField(fieldId: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete(`/template-sets/fields/${fieldId}`);
  }

  generateTemplateSet(setId: string, instruction: string): Observable<Blob> {
    return this.api.postBlob(`/generate/set/${setId}`, { instruction });
  }
}