import { Component, OnInit, inject } from '@angular/core';
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

  templateSet: TemplateSetDetails | null = null;
  isLoading = true;
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
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'undefined' && id !== 'null') {
      this.loadTemplateSet(id);
    } else {
      this.toast.show('error', 'Error', 'Invalid template set ID');
      this.router.navigate(['/template-sets']);
    }
  }

  loadTemplateSet(id: string): void {
    this.isLoading = true;
    this.templateSetService.getTemplateSet(id).subscribe({
      next: (res) => {
        this.templateSet = res;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.toast.show('error', 'Error', 'Failed to load template set');
        this.isLoading = false;
      }
    });
  }

  // ✅ Refresh templates list
  refreshTemplates(): void {
    if (this.templateSet) {
      this.loadTemplateSet(this.templateSet.id);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.templateName = this.selectedFile.name.replace('.docx', '');
    }
  }

  async uploadTemplateToSet(): Promise<void> {
    if (!this.templateSet) {
      this.toast.show('error', 'Error', 'No template set selected');
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
    
    const interval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 200);

    try {
      // Upload template first
      const uploadedTemplate = await this.templateService.uploadTemplate(this.templateName, this.selectedFile);
      
      // Then add to set
      await this.templateSetService.addTemplateToSet(this.templateSet.id, { 
        template_id: uploadedTemplate.id 
      }).toPromise();
      
      clearInterval(interval);
      this.uploadProgress = 100;
      
      this.toast.show('success', 'Uploaded!', `${this.templateName} uploaded successfully`);
      
      // ✅ Reset form
      this.selectedFile = null;
      this.templateName = '';
      this.uploadProgress = 0;
      
      // ✅ Refresh the template set to show new template
      this.loadTemplateSet(this.templateSet.id);
      
      // Clear file input
      const fileInput = document.getElementById('template-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      // ✅ Better error message
      const errorMsg = err?.message || err?.error?.detail || 'Failed to upload template';
      this.toast.show('error', 'Upload Failed', errorMsg);
    } finally {
      setTimeout(() => {
        this.isUploading = false;
      }, 500);
    }
  }

  removeTemplate(templateId: string): void {
    if (!this.templateSet) return;
    if (confirm('Remove this template from the set?')) {
      this.templateSetService.removeTemplateFromSet(this.templateSet.id, templateId).subscribe({
        next: () => {
          this.toast.show('success', 'Removed', 'Template removed from set');
          this.loadTemplateSet(this.templateSet!.id);
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to remove template');
        }
      });
    }
  }

  addSharedField(): void {
    if (!this.templateSet || !this.newField.field_name?.trim() || !this.newField.field_label?.trim()) {
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
      },
      error: (err) => {
        console.error(err);
        this.toast.show('error', 'Error', 'Failed to add shared field');
      }
    });
  }

  deleteSharedField(fieldId: string): void {
    if (confirm('Delete this shared field?')) {
      this.templateSetService.deleteSharedField(fieldId).subscribe({
        next: () => {
          this.toast.show('success', 'Deleted', 'Shared field deleted');
          this.loadTemplateSet(this.templateSet!.id);
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
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.templateSet!.name}_documents.zip`;
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