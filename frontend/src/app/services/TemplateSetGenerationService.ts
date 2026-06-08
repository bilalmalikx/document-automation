import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api';
import { TemplateSetService } from './template-set';
import { Template } from './template';

export interface TemplateSetGroup {
  id: string;
  name: string;
  description: string;
  templates: Template[];
  isExpanded: boolean;
  selectedTemplateIds: string[];
}

@Injectable({ providedIn: 'root' })
export class TemplateSetGenerationService {
  private api = inject(ApiService);
  private templateSetService = inject(TemplateSetService);

  async loadAllTemplateSetsWithTemplates(): Promise<TemplateSetGroup[]> {
    try {
      // Get all template sets
      const setsResponse = await lastValueFrom(this.templateSetService.getTemplateSets());
      const templateSets = setsResponse.template_sets;
      
      const groups: TemplateSetGroup[] = [];
      
      for (const set of templateSets) {
        // Get detailed set info including templates
        const detail = await lastValueFrom(this.templateSetService.getTemplateSet(set.id));
        
        // Convert to Template format expected by the existing UI
        const templates: Template[] = (detail.templates || []).map((t: any) => ({
          id: t.id,
          filename: t.filename,
          original_filename: t.original_filename || t.filename,
          placeholders: t.placeholders || [],
          placeholder_count: t.placeholder_count || 0,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at
        }));
        
        groups.push({
          id: set.id,
          name: set.name,
          description: set.description || '',
          templates: templates,
          isExpanded: false,
          selectedTemplateIds: []
        });
      }
      
      return groups;
    } catch (err) {
      console.error('Failed to load template sets:', err);
      return [];
    }
  }
}