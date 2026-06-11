import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { TemplateService } from '../../services/template';
import { ToastService } from '../../services/toast';
import { TemplateSetDetail, TemplateSetTemplate } from '../../models/template-set.model';

interface PlaceholderItem {
  originalName: string;
  displayName: string;
  newName: string;
  templateIds: string[];
  templateNames: string[];
  groupId?: string;
  isEditing?: boolean;
  isUpdating?: boolean;
}

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
  
  showPlaceholderModal = false;
  selectedTemplateForPlaceholders: TemplateSetTemplate | null = null;
  extractedPlaceholders: string[] = [];
  isExtractingPlaceholders = false;

  allPlaceholders: PlaceholderItem[] = [];
  isLoadingPlaceholders = false;
  isSavingPlaceholders = false;
  showPlaceholderManagement = true;
  searchPlaceholderQuery = '';
  filterType: 'all' | 'similar' | 'unique' = 'all';

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
      next: async (res: any) => {
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
        
        await this.extractAllPlaceholders();
        
        // Refresh global templates for generate page
        this.templateService.loadTemplates();
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

  async extractAllPlaceholders(): Promise<void> {
    if (!this.templateSet || this.templateSet.templates.length === 0) {
      this.allPlaceholders = [];
      return;
    }

    this.isLoadingPlaceholders = true;
    this.cdr.detectChanges();

    try {
      const placeholderMap = new Map<string, PlaceholderItem>();
      
      for (let i = 0; i < this.templateSet.templates.length; i++) {
        const currentTemplate: any = this.templateSet.templates[i];
        let placeholdersList: string[] = [];
        
        if (currentTemplate.placeholders && currentTemplate.placeholders.length > 0) {
          placeholdersList = currentTemplate.placeholders;
        } else {
          try {
            placeholdersList = await this.templateService.getPlaceholders(currentTemplate.id);
            currentTemplate.placeholders = placeholdersList;
          } catch (err) {
            console.error(`Failed to get placeholders for ${currentTemplate.filename}`, err);
            continue;
          }
        }
        
        for (const ph of placeholdersList) {
          if (placeholderMap.has(ph)) {
            const existing = placeholderMap.get(ph)!;
            if (!existing.templateIds.includes(currentTemplate.id)) {
              existing.templateIds.push(currentTemplate.id);
              existing.templateNames.push(currentTemplate.filename);
            }
          } else {
            placeholderMap.set(ph, {
              originalName: ph,
              displayName: this.getPlaceholderLabel(ph),
              newName: ph,
              templateIds: [currentTemplate.id],
              templateNames: [currentTemplate.filename],
              isEditing: false,
              isUpdating: false
            });
          }
        }
      }
      
      this.allPlaceholders = Array.from(placeholderMap.values());
      this.identifySimilarPlaceholders();
      
      this.toast.show('success', 'Placeholders Extracted', `${this.allPlaceholders.length} unique placeholders found`);
      
    } catch (err) {
      console.error('Failed to extract placeholders:', err);
      this.toast.show('error', 'Error', 'Failed to extract placeholders');
    } finally {
      this.isLoadingPlaceholders = false;
      this.cdr.detectChanges();
    }
  }

  identifySimilarPlaceholders(): void {
    const groups: Map<string, string[]> = new Map();
    
    for (const ph of this.allPlaceholders) {
      let baseName = ph.originalName
        .replace(/_name$|_no$|_number$|_email$|_id$|_code$|_date$|_at$|_by$/gi, '')
        .toLowerCase();
      
      if (baseName.length < 3) {
        baseName = ph.originalName.split('_')[0].toLowerCase();
      }
      
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push(ph.originalName);
    }
    
    for (const [groupKey, similarPlaceholders] of groups) {
      if (similarPlaceholders.length > 1) {
        for (const phName of similarPlaceholders) {
          const placeholder = this.allPlaceholders.find(p => p.originalName === phName);
          if (placeholder) {
            placeholder.groupId = `group_${groupKey}`;
          }
        }
      }
    }
  }

  getFilteredPlaceholders(): PlaceholderItem[] {
    let filtered = [...this.allPlaceholders];
    
    if (this.searchPlaceholderQuery.trim()) {
      const query = this.searchPlaceholderQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.originalName.toLowerCase().includes(query) ||
        p.displayName.toLowerCase().includes(query) ||
        p.newName.toLowerCase().includes(query)
      );
    }
    
    if (this.filterType === 'similar') {
      filtered = filtered.filter(p => p.groupId !== undefined);
    } else if (this.filterType === 'unique') {
      filtered = filtered.filter(p => p.groupId === undefined);
    }
    
    return filtered;
  }

  getGroupedPlaceholders(): Map<string, PlaceholderItem[]> {
    const groups = new Map<string, PlaceholderItem[]>();
    
    for (const ph of this.allPlaceholders) {
      if (ph.groupId) {
        if (!groups.has(ph.groupId)) {
          groups.set(ph.groupId, []);
        }
        groups.get(ph.groupId)!.push(ph);
      }
    }
    
    return groups;
  }

  getUniquePlaceholders(): PlaceholderItem[] {
    return this.allPlaceholders.filter(p => !p.groupId);
  }

  startEditing(placeholder: PlaceholderItem): void {
    placeholder.isEditing = true;
    placeholder.newName = placeholder.originalName;
    this.cdr.detectChanges();
  }

  cancelEditing(placeholder: PlaceholderItem): void {
    placeholder.isEditing = false;
    placeholder.newName = placeholder.originalName;
    this.cdr.detectChanges();
  }

  async savePlaceholderChange(placeholder: PlaceholderItem): Promise<void> {
    if (placeholder.newName === placeholder.originalName) {
      placeholder.isEditing = false;
      return;
    }
    
    placeholder.isUpdating = true;
    this.isSavingPlaceholders = true;
    this.cdr.detectChanges();
    
    try {
      let successCount = 0;
      
      for (const templateId of placeholder.templateIds) {
        try {
          await this.templateService.updatePlaceholderInTemplate(templateId, placeholder.originalName, placeholder.newName);
          successCount++;
        } catch (err) {
          console.error(`Failed to update in template ${templateId}`, err);
        }
      }
      
      if (this.templateSet) {
        for (let i = 0; i < this.templateSet.templates.length; i++) {
          const currentTemplate: any = this.templateSet.templates[i];
          if (placeholder.templateIds.includes(currentTemplate.id) && currentTemplate.placeholders) {
            const index = currentTemplate.placeholders.indexOf(placeholder.originalName);
            if (index !== -1) {
              currentTemplate.placeholders[index] = placeholder.newName;
            }
          }
        }
      }
      
      placeholder.originalName = placeholder.newName;
      placeholder.displayName = this.getPlaceholderLabel(placeholder.newName);
      placeholder.isEditing = false;
      
      this.identifySimilarPlaceholders();
      
      // 🔥 CRITICAL: Refresh global templates for generate page
      this.templateService.loadTemplates();
      
      if (successCount > 0) {
        this.toast.show('success', 'Updated', `Placeholder renamed in ${successCount} template(s)`);
      } else {
        this.toast.show('info', 'Saved', 'Placeholder name updated locally');
      }
      
    } catch (err) {
      console.error('Failed to update placeholder:', err);
      this.toast.show('error', 'Error', 'Failed to update placeholder');
    } finally {
      placeholder.isUpdating = false;
      this.isSavingPlaceholders = false;
      this.cdr.detectChanges();
    }
  }

  async saveAllPlaceholderChanges(): Promise<void> {
    const changedPlaceholders = this.allPlaceholders.filter(p => p.newName !== p.originalName);
    
    if (changedPlaceholders.length === 0) {
      this.toast.show('info', 'No Changes', 'No placeholder changes to save');
      return;
    }
    
    this.isSavingPlaceholders = true;
    this.cdr.detectChanges();
    
    try {
      for (const ph of changedPlaceholders) {
        ph.isUpdating = true;
        this.cdr.detectChanges();
        
        for (const templateId of ph.templateIds) {
          try {
            await this.templateService.updatePlaceholderInTemplate(templateId, ph.originalName, ph.newName);
          } catch (err) {
            console.error(`Failed to update in template ${templateId}`, err);
          }
        }
        
        ph.originalName = ph.newName;
        ph.displayName = this.getPlaceholderLabel(ph.newName);
        ph.isEditing = false;
        ph.isUpdating = false;
      }
      
      if (this.templateSet) {
        for (const ph of changedPlaceholders) {
          for (let i = 0; i < this.templateSet.templates.length; i++) {
            const currentTemplate: any = this.templateSet.templates[i];
            if (ph.templateIds.includes(currentTemplate.id) && currentTemplate.placeholders) {
              const index = currentTemplate.placeholders.indexOf(ph.originalName);
              if (index !== -1) {
                currentTemplate.placeholders[index] = ph.newName;
              }
            }
          }
        }
      }
      
      this.identifySimilarPlaceholders();
      
      // 🔥 CRITICAL: Refresh global templates for generate page
      this.templateService.loadTemplates();
      
      this.toast.show('success', 'All Saved', `${changedPlaceholders.length} placeholder(s) updated`);
      
    } catch (err) {
      console.error('Failed to save placeholders:', err);
      this.toast.show('error', 'Error', 'Failed to save placeholder changes');
    } finally {
      this.isSavingPlaceholders = false;
      this.cdr.detectChanges();
    }
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  async onFileSelectedAndUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.cdr.detectChanges();
      await this.uploadTemplateToSet();
    }
  }

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
      
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
      
      // Refresh global templates
      this.templateService.loadTemplates();
      
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
          this.templateService.loadTemplates(); // Refresh global templates
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to remove template');
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/template-sets']);
  }
}