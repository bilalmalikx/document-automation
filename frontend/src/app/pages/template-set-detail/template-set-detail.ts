import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { TemplateService } from '../../services/template';
import { ToastService } from '../../services/toast';
import { TemplateSetDetail, SharedField, TemplateSetTemplate } from '../../models/template-set.model';

@Component({
  selector: 'app-template-set-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './template-set-detail.html',
  styleUrl: './template-set-detail.css',
})
export class TemplateSetDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private templateSetService = inject(TemplateSetService);
  private templateService = inject(TemplateService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  templateSet: TemplateSetDetail | null = null;
  isLoading = true;
  errorMessage = '';
  
  isUploading = false;
  uploadProgress = 0;
  selectedFile: File | null = null;
  
  showAddFieldModal = false;
  newField: Partial<SharedField> = { 
    field_name: '', 
    field_label: '', 
    field_type: 'text', 
    is_required: false 
  };

  // For placeholder modal
  showPlaceholderModal = false;
  selectedTemplateForPlaceholders: TemplateSetTemplate | null = null;
  extractedPlaceholders: string[] = [];
  isExtractingPlaceholders = false;

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

  // Trigger file input click
  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  // On file select - immediately upload
  async onFileSelectedAndUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.cdr.detectChanges();
      await this.uploadTemplateToSet();
    }
  }

  // View placeholders for a template
  async viewPlaceholders(template: TemplateSetTemplate): Promise<void> {
    this.selectedTemplateForPlaceholders = template;
    this.showPlaceholderModal = true;
    this.isExtractingPlaceholders = true;
    this.cdr.detectChanges();
    
    try {
      const placeholders = await this.templateService.getPlaceholders(template.id);
      this.extractedPlaceholders = placeholders;
      this.toast.show('info', 'Placeholders', `${placeholders.length} placeholders found`);
    } catch (err) {
      console.error(err);
      this.toast.show('error', 'Error', 'Failed to extract placeholders');
      this.extractedPlaceholders = [];
    } finally {
      this.isExtractingPlaceholders = false;
      this.cdr.detectChanges();
    }
  }

  closePlaceholderModal(): void {
    this.showPlaceholderModal = false;
    this.selectedTemplateForPlaceholders = null;
    this.extractedPlaceholders = [];
  }

  getPlaceholderLabel(placeholder: string): string {
    return placeholder
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

    const templateName = this.selectedFile.name.replace('.docx', '').replace('.doc', '');
    
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
      const uploadedTemplate = await this.templateService.uploadTemplate(templateName, this.selectedFile);
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
      
      this.toast.show('success', 'Uploaded!', `${templateName} uploaded successfully`);
      
      this.selectedFile = null;
      this.uploadProgress = 0;
      
      await this.loadTemplateSet(setId);
      
      // Clear the file input
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
      
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

  goBack(): void {
    this.router.navigate(['/template-sets']);
  }
}