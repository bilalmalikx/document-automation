import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { TemplateService } from '../../services/template';
import { ToastService } from '../../services/toast';
import { Template } from '../../models/template.model';
import { TemplateSetDetails, SharedField } from '../../models/template-set.model';

@Component({
  selector: 'app-template-set-detail',
  imports: [CommonModule, FormsModule],
  templateUrl: './template-set-detail.html',
  styleUrl: './template-set-detail.css',
})

export class TemplateSetDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private templateSetService = inject(TemplateSetService);
  private templateService = inject(TemplateService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  templateSet: TemplateSetDetails | null = null;
  templateSetId: string | null = null;
  isLoading = true;
  errorMessage = '';
  isUploading = false;
  uploadProgress = 0;
  showAddFieldModal = false;
  newField: Partial<SharedField> = { field_name: '', field_label: '', field_type: 'text', is_required: false };
  
  selectedFile: File | null = null;
  templateName = '';

  get mappedPercentage(): number {
    if (!this.templateSet || !this.templateSet.templates.length) return 0;
    const totalPlaceholders = this.templateSet.templates.reduce((sum, t) => sum + t.placeholder_count, 0);
    const mappedPlaceholders = this.templateSet.shared_fields.length;
    return Math.round((mappedPlaceholders / totalPlaceholders) * 100);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      console.log('Route ID:', id);
      
      if (id && id !== 'undefined' && id !== 'null') {
        this.templateSetId = id;
        this.loadTemplateSet(id);
      } else {
        this.errorMessage = 'Invalid template set ID';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadTemplateSet(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    console.log('Fetching template set:', id);
    
    this.templateSetService.getTemplateSet(id).subscribe({
      next: (res) => {
        console.log('Template set loaded:', res);
        this.templateSet = res;
        this.templateSetId = res.id;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error:', err);
        this.errorMessage = 'Failed to load template set';
        this.isLoading = false;
        this.cdr.detectChanges();
        this.toast.show('error', 'Error', this.errorMessage);
      }
    });
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
    const setId = this.templateSetId || this.templateSet?.id;
    
    console.log('Set ID for upload:', setId);
    
    if (!setId || setId === 'undefined' || setId === 'null') {
      this.toast.show('error', 'Error', 'Invalid template set ID');
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
      // Step 1: Upload template
      const uploadedTemplate = await this.templateService.uploadTemplate(this.templateName, this.selectedFile);
      console.log('Template uploaded:', uploadedTemplate);
      
      // Step 2: Add to set
      await this.templateSetService.addTemplateToSet(setId, { 
        template_id: uploadedTemplate.id 
      }).toPromise();
      console.log('Added to set successfully');
      
      clearInterval(interval);
      this.uploadProgress = 100;
      this.cdr.detectChanges();
      
      this.toast.show('success', 'Uploaded!', `${this.templateName} uploaded successfully`);
      
      // Reset form
      this.selectedFile = null;
      this.templateName = '';
      this.uploadProgress = 0;
      
      // ✅ CRITICAL: Reload the template set to show new template
      await this.loadTemplateSet(setId);
      
      // Clear file input
      const fileInput = document.getElementById('template-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (err: any) {
      clearInterval(interval);
      console.error('Upload error:', err);
      
      let errorMsg = 'Failed to upload template';
      if (err?.error?.detail) {
        errorMsg = err.error.detail;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      
      this.toast.show('error', 'Upload Failed', errorMsg);
    } finally {
      setTimeout(() => {
        this.isUploading = false;
        this.cdr.detectChanges();
      }, 500);
    }
  }

  removeTemplate(templateId: string): void {
    const setId = this.templateSetId || this.templateSet?.id;
    if (!setId) return;
    
    if (confirm('Remove this template from the set?')) {
      this.templateSetService.removeTemplateFromSet(setId, templateId).subscribe({
        next: () => {
          this.toast.show('success', 'Removed', 'Template removed from set');
          this.loadTemplateSet(setId);
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to remove template');
        }
      });
    }
  }

  addSharedField(): void {
    const setId = this.templateSetId || this.templateSet?.id;
    if (!setId) return;
    
    if (!this.newField.field_name?.trim() || !this.newField.field_label?.trim()) {
      this.toast.show('error', 'Validation', 'Field name and label are required');
      return;
    }

    this.templateSetService.addSharedField(setId, {
      field_name: this.newField.field_name,
      field_label: this.newField.field_label,
      field_type: this.newField.field_type || 'text',
      is_required: this.newField.is_required || false
    }).subscribe({
      next: () => {
        this.toast.show('success', 'Added', 'Shared field added');
        this.showAddFieldModal = false;
        this.newField = { field_name: '', field_label: '', field_type: 'text', is_required: false };
        this.loadTemplateSet(setId);
      },
      error: (err) => {
        console.error(err);
        this.toast.show('error', 'Error', 'Failed to add shared field');
      }
    });
  }

  deleteSharedField(fieldId: string): void {
    const setId = this.templateSetId || this.templateSet?.id;
    if (!setId) return;
    
    if (confirm('Delete this shared field?')) {
      this.templateSetService.deleteSharedField(fieldId).subscribe({
        next: () => {
          this.toast.show('success', 'Deleted', 'Shared field deleted');
          this.loadTemplateSet(setId);
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to delete shared field');
        }
      });
    }
  }

  generateAll(): void {
    const setId = this.templateSetId || this.templateSet?.id;
    if (!setId) return;
    
    const instruction = prompt('Enter instruction for all templates:', `Generate documents for ${this.templateSet?.name || 'this set'}`);
    if (instruction) {
      this.templateSetService.generateTemplateSet(setId, instruction).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.templateSet?.name || 'documents'}_set.zip`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.toast.show('success', 'Generated', 'Documents generated successfully');
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to generate documents');
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/template-sets']);
  }
}