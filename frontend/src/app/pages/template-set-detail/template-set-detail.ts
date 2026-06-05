import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { TemplateService } from '../../services/template';
import { ToastService } from '../../services/toast';
import { TemplateSetDetail, SharedField, TemplateSetTemplate } from '../../models/template-set.model';
import { DomSanitizer } from '@angular/platform-browser';
import { GenerateService } from '../../services/generate';
import { Template } from '../../models/template.model';
import { renderAsync } from 'docx-preview';

@Component({
  selector: 'app-template-set-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-set-detail.html',
  styleUrl: './template-set-detail.css',
})
export class TemplateSetDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private templateSetService = inject(TemplateSetService);
  private templateService = inject(TemplateService);
  private generateService = inject(GenerateService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  templateSet: TemplateSetDetail | null = null;
  isLoading = true;
  errorMessage = '';
  
  isUploading = false;
  uploadProgress = 0;
  selectedFile: File | null = null;
  templateName = '';
  
  showAddFieldModal = false;
  newField: Partial<SharedField> = { 
    field_name: '', 
    field_label: '', 
    field_type: 'text', 
    is_required: false 
  };
  
  // Selected Template & Placeholder Management
  selectedTemplate: TemplateSetTemplate | null = null;
  selectedTemplatePlaceholders: Record<string, string> = {};
  instruction = '';
  isExtracting = false;
  isGenerating = false;
  showManualForm = false;

  get mappedPercentage(): number {
    if (!this.templateSet || !this.templateSet.templates?.length) return 0;
    const totalPlaceholders = this.templateSet.templates.reduce((sum, t) => sum + (t.placeholder_count || 0), 0);
    const mappedPlaceholders = this.templateSet.shared_fields?.length || 0;
    if (totalPlaceholders === 0) return 0;
    return Math.round((mappedPlaceholders / totalPlaceholders) * 100);
  }

  get placeholderEntries(): Array<{key: string, value: string}> {
    return Object.entries(this.selectedTemplatePlaceholders).map(([key, value]) => ({ key, value }));
  }

  get hasManualValues(): boolean {
    return Object.keys(this.selectedTemplatePlaceholders).length > 0;
  }

  getFilledCount(): number {
    return Object.values(this.selectedTemplatePlaceholders).filter(v => v && v.trim()).length;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTemplateSet(id);
    } else {
      this.errorMessage = 'No template set ID provided';
      this.isLoading = false;
    }
  }

  loadTemplateSet(id: string): void {
    this.isLoading = true;
    this.templateSetService.getTemplateSet(id).subscribe({
      next: (res: any) => {
        const normalizedSet = {
          id: res.id || res.set_id || id,
          name: res.name || '',
          description: res.description || '',
          templates: res.templates || [],
          shared_fields: res.shared_fields || res.sharedFields || [],
          total_templates: res.total_templates || (res.templates?.length || 0),
          total_shared_fields: res.total_shared_fields || (res.shared_fields?.length || 0),
          created_at: res.created_at || new Date().toISOString(),
          updated_at: res.updated_at || null
        };
        
        this.templateSet = normalizedSet as TemplateSetDetail;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Template set not found';
        this.isLoading = false;
        this.toast.show('error', 'Error', this.errorMessage);
        this.cdr.detectChanges();
      }
    });
  }

  selectTemplate(template: TemplateSetTemplate): void {
    this.selectedTemplate = template;
    this.selectedTemplatePlaceholders = {};
    this.instruction = '';
    this.showManualForm = false;
    
    const placeholders = template.placeholders || [];
    for (const ph of placeholders) {
      this.selectedTemplatePlaceholders[ph] = '';
    }
    
    this.cdr.detectChanges();
    this.toast.show('info', 'Template Selected', `${template.filename} - ${placeholders.length} placeholders found`);
  }

  async extractValuesWithAI(): Promise<void> {
    if (!this.selectedTemplate) {
      this.toast.show('error', 'Error', 'Please select a template first');
      return;
    }
    
    if (!this.instruction.trim()) {
      this.toast.show('error', 'Error', 'Please enter an instruction first');
      return;
    }
    
    this.isExtracting = true;
    this.cdr.detectChanges();
    
    try {
      const templateId = this.selectedTemplate.id;
      const result = await this.generateService.preview(this.instruction, templateId);
      this.selectedTemplatePlaceholders = result.mapped_values;
      this.showManualForm = true;
      this.toast.show('success', 'Extracted', `Values extracted for ${Object.keys(result.mapped_values).length} placeholders`);
      this.cdr.detectChanges();
    } catch (err) {
      console.error(err);
      this.toast.show('error', 'Error', 'Failed to extract values from instruction');
    } finally {
      this.isExtracting = false;
      this.cdr.detectChanges();
    }
  }

  updateManualValue(placeholder: string, event: any): void {
    this.selectedTemplatePlaceholders[placeholder] = event.target.value;
    this.cdr.detectChanges();
  }

  async generateAndDownload(): Promise<void> {
    if (!this.selectedTemplate) {
      this.toast.show('error', 'Error', 'Please select a template first');
      return;
    }
    
    const filledValues = Object.entries(this.selectedTemplatePlaceholders)
      .filter(([, value]) => value && value.trim());
    
    if (filledValues.length === 0) {
      this.toast.show('error', 'Error', 'Please fill at least one placeholder value');
      return;
    }
    
    const instruction = filledValues
      .map(([key, value]) => `${key.replace(/_/g, ' ')} is ${value}`)
      .join(', ');
    
    this.isGenerating = true;
    this.cdr.detectChanges();
    
    try {
      const templateId = this.selectedTemplate.id;
      const blob = await this.generateService.generate(instruction, templateId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.selectedTemplate.filename;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.show('success', 'Downloaded', `${this.selectedTemplate.filename} downloaded successfully`);
    } catch (err) {
      console.error(err);
      this.toast.show('error', 'Error', 'Failed to generate document');
    } finally {
      this.isGenerating = false;
      this.cdr.detectChanges();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.templateName = this.selectedFile.name.replace('.docx', '');
      this.cdr.detectChanges();
    }
  }

  async uploadTemplateToSet(): Promise<void> {
    let setId = this.templateSet?.id;
    if (!setId) {
      setId = this.route.snapshot.paramMap.get('id') || '';
    }
    if (!setId) {
      this.toast.show('error', 'Error', 'Template set ID not found');
      return;
    }
    if (!this.selectedFile) {
      this.toast.show('error', 'Error', 'Please select a file');
      return;
    }
    if (!this.templateName.trim()) {
      this.toast.show('error', 'Error', 'Please enter template name');
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.cdr.detectChanges();
    
    const interval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
        this.cdr.detectChanges();
      }
    }, 200);

    try {
      const uploadedTemplate = await this.templateService.uploadTemplate(this.templateName, this.selectedFile);
      if (!uploadedTemplate || !uploadedTemplate.id) {
        throw new Error('Template upload failed');
      }
      
      this.uploadProgress = 95;
      this.cdr.detectChanges();
      
      await this.templateSetService.addTemplateToSet(setId, { template_id: uploadedTemplate.id }).toPromise();
      
      clearInterval(interval);
      this.uploadProgress = 100;
      this.cdr.detectChanges();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.toast.show('success', 'Uploaded!', `${this.templateName} uploaded successfully`);
      
      this.selectedFile = null;
      this.templateName = '';
      this.uploadProgress = 0;
      
      await this.loadTemplateSet(setId);
      
      const fileInput = document.getElementById('template-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (err: any) {
      clearInterval(interval);
      console.error('Upload error:', err);
      this.uploadProgress = 0;
      this.toast.show('error', 'Upload Failed', err.message || 'Failed to upload template');
    } finally {
      setTimeout(() => {
        this.isUploading = false;
        this.cdr.detectChanges();
      }, 500);
    }
  }

  removeTemplate(templateId: string): void {
    if (!this.templateSet) return;
    if (confirm('Remove this template from the set?')) {
      this.templateSetService.removeTemplateFromSet(this.templateSet.id, templateId).subscribe({
        next: () => {
          this.toast.show('success', 'Removed', 'Template removed');
          this.loadTemplateSet(this.templateSet!.id);
          if (this.selectedTemplate?.id === templateId) {
            this.selectedTemplate = null;
            this.selectedTemplatePlaceholders = {};
            this.showManualForm = false;
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to remove template');
        }
      });
    }
  }

  addSharedField(): void {
    if (!this.templateSet) return;
    if (!this.newField.field_name?.trim() || !this.newField.field_label?.trim()) {
      this.toast.show('error', 'Validation', 'Field name and label are required');
      return;
    }

    this.templateSetService.addSharedField(this.templateSet.id, {
      field_name: this.newField.field_name,
      field_label: this.newField.field_label,
      field_type: this.newField.field_type || 'text',
      is_required: this.newField.is_required || false
    }).subscribe({
      next: () => {
        this.toast.show('success', 'Added', 'Shared field added');
        this.showAddFieldModal = false;
        this.newField = { field_name: '', field_label: '', field_type: 'text', is_required: false };
        this.loadTemplateSet(this.templateSet!.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toast.show('error', 'Error', 'Failed to add shared field');
      }
    });
  }

  deleteSharedField(fieldId: string): void {
    if (!this.templateSet) return;
    if (confirm('Delete this shared field?')) {
      this.templateSetService.deleteSharedField(fieldId).subscribe({
        next: () => {
          this.toast.show('success', 'Deleted', 'Shared field deleted');
          this.loadTemplateSet(this.templateSet!.id);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to delete shared field');
        }
      });
    }
  }

  generateAll(): void {
    if (!this.templateSet) return;
    const instruction = prompt('Enter instruction for all templates:', `Generate documents for ${this.templateSet.name}`);
    if (instruction) {
      this.templateSetService.generateTemplateSet(this.templateSet.id, instruction).subscribe({
        next: (blob) => {
          if (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.templateSet!.name}_documents.zip`;
            a.click();
            window.URL.revokeObjectURL(url);
            this.toast.show('success', 'Generated', 'All documents generated');
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', err.message || 'Failed to generate documents');
        }
      });
    }
  }

  getPlaceholderLabel(placeholder: string): string {
    return placeholder
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  goBack(): void {
    this.router.navigate(['/template-sets']);
  }
}