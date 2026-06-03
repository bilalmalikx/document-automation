import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { TemplateService } from '../../services/template';
import { ToastService } from '../../services/toast';
import { TemplateSetDetail, SharedField } from '../../models/template-set.model';

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
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  templateSet: TemplateSetDetail | null = null;
  isLoading = true;
  errorMessage = '';
  isUploading = false;
  uploadProgress = 0;
  showAddFieldModal = false;
  newField: Partial<SharedField> = { 
    field_name: '', 
    field_label: '', 
    field_type: 'text', 
    is_required: false 
  };
  
  selectedFile: File | null = null;
  templateName = '';

  get mappedPercentage(): number {
    if (!this.templateSet || !this.templateSet.templates?.length) return 0;
    const totalPlaceholders = this.templateSet.templates.reduce((sum, t) => sum + (t.placeholder_count || 0), 0);
    const mappedPlaceholders = this.templateSet.shared_fields?.length || 0;
    if (totalPlaceholders === 0) return 0;
    return Math.round((mappedPlaceholders / totalPlaceholders) * 100);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    console.log('ID from route:', id);
    
    if (id) {
      this.loadTemplateSet(id);
    } else {
      this.errorMessage = 'No template set ID provided';
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  loadTemplateSet(id: string): void {
    this.isLoading = true;
    this.cdr.detectChanges();
    console.log('Loading template set:', id);
    
    this.templateSetService.getTemplateSet(id).subscribe({
      next: (res: any) => {
        console.log('Loaded template set (raw):', res);
        
        // Normalize the response to ensure all properties exist
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
        
        console.log('Normalized template set:', normalizedSet);
        console.log('Templates in set:', normalizedSet.templates);
        console.log('Shared fields:', normalizedSet.shared_fields);
        
        this.templateSet = normalizedSet as TemplateSetDetail;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading template set:', err);
        this.errorMessage = 'Template set not found';
        this.isLoading = false;
        this.toast.show('error', 'Error', this.errorMessage);
        this.cdr.detectChanges();
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
  console.log('Current templateSet:', this.templateSet);
  
  // Get ID from multiple sources
  let setId = this.templateSet?.id;
  
  if (!setId) {
    setId = this.route.snapshot.paramMap.get('id') || '';
    console.log('Using route ID as fallback:', setId);
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
    console.log('Template uploaded:', uploadedTemplate);
    
    if (!uploadedTemplate || !uploadedTemplate.id) {
      throw new Error('Template upload failed - no ID returned');
    }
    
    // Update to 95%
    this.uploadProgress = 95;
    this.cdr.detectChanges();
    
    const addResult = await this.templateSetService.addTemplateToSet(setId, { 
      template_id: uploadedTemplate.id 
    }).toPromise();
    
    console.log('Added to set result:', addResult);
    
    clearInterval(interval);
    
    // Set to 100% before showing success
    this.uploadProgress = 100;
    this.cdr.detectChanges();
    
    // Wait a moment to show 100%
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.toast.show('success', 'Uploaded!', `${this.templateName} uploaded successfully`);
    
    this.selectedFile = null;
    this.templateName = '';
    
    // Reset progress
    setTimeout(() => {
      this.uploadProgress = 0;
      this.cdr.detectChanges();
    }, 500);
    
    await this.loadTemplateSet(setId);
    
    const fileInput = document.getElementById('template-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
  } catch (err: any) {
    clearInterval(interval);
    console.error('Upload error details:', err);
    this.uploadProgress = 0;
    this.toast.show('error', 'Upload Failed', err.message || 'Failed to upload template');
    this.cdr.detectChanges();
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
          this.toast.show('success', 'Removed', 'Template removed from set');
          this.loadTemplateSet(this.templateSet!.id);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to remove template');
          this.cdr.detectChanges();
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
        this.cdr.detectChanges();
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
          this.cdr.detectChanges();
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
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to generate documents');
          this.cdr.detectChanges();
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/template-sets']);
  }
}