import { Component, OnInit, ElementRef, ViewChild, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { TemplateService, Template } from '../../services/template';
import { GenerateService } from '../../services/generate';
import { renderAsync } from 'docx-preview';
import { TemplateSetGenerationService, TemplateSetGroup } from '../../services/TemplateSetGenerationService';

@Component({
  selector: 'app-generate-page',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './generate-page.html',
  styleUrls: ['./generate-page.css']
})
export class GeneratePage implements OnInit {
  @ViewChild('docxPreviewContainer') docxPreviewContainer!: ElementRef;
  
  // Template Set Groups
  templateSetGroups: TemplateSetGroup[] = [];
  isLoadingGroups = true;
  
  // Selection state
  selectedSetId: string | null = null;
  selectedTemplates: Template[] = [];
  
  // Generation state
  step = 1;
  instruction = '';
  previewData: Record<string, string> = {};
  isPreviewing = false;
  isGeneratingForDownload = false;
  isGeneratingBulk = false;
  
  generatedBlob: Blob | null = null;
  
  showDocumentPreview = false;
  isRenderingPreview = false;
  previewError = '';
  currentPreviewBlob: Blob | null = null;
  
  manualValues: Record<string, string> = {};
  showManualForm = false;
  
  private previewTimeout: any = null;

  get tokenCount(): number {
    const words = this.instruction.split(/\s+/).filter(w => w.length > 0).length;
    return Math.ceil(words * 1.3);
  }

  get hasPreviewData(): boolean {
    return Object.keys(this.previewData).length > 0;
  }

  get previewEntries(): Array<{key: string, value: string}> {
    return Object.entries(this.previewData).map(([key, value]) => ({ key, value }));
  }

  getFilledManualValuesCount(): number {
    return Object.keys(this.manualValues).filter(k => this.manualValues[k] && this.manualValues[k].trim()).length;
  }

  getManualValuesEntries(): Array<{key: string, value: string}> {
    return Object.entries(this.manualValues).map(([key, value]) => ({ key, value }));
  }

  hasManualValues(): boolean {
    return Object.keys(this.manualValues).length > 0;
  }

  // Get all unique placeholders from selected templates
  getAllPlaceholdersFromSelected(): string[] {
    const placeholdersSet = new Set<string>();
    for (const template of this.selectedTemplates) {
      for (const ph of template.placeholders) {
        placeholdersSet.add(ph);
      }
    }
    return Array.from(placeholdersSet);
  }

  getPlaceholderLabel(placeholder: string): string {
    return placeholder
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private templateSetGenService: TemplateSetGenerationService,
    private generateService: GenerateService,
    private templateService: TemplateService
  ) {}

  async ngOnInit() {
    await this.loadTemplateSets();
  }

  async loadTemplateSets() {
    this.isLoadingGroups = true;
    this.templateSetGroups = await this.templateSetGenService.loadAllTemplateSetsWithTemplates();
    this.isLoadingGroups = false;
    this.cdr.detectChanges();
  }

  toggleSetExpansion(setId: string): void {
    const group = this.templateSetGroups.find(g => g.id === setId);
    if (group) {
      group.isExpanded = !group.isExpanded;
    }
    this.cdr.detectChanges();
  }

  toggleTemplateSelection(template: Template, setId: string): void {
    const group = this.templateSetGroups.find(g => g.id === setId);
    if (!group) return;
    
    const index = group.selectedTemplateIds.indexOf(template.id);
    if (index === -1) {
      group.selectedTemplateIds.push(template.id);
    } else {
      group.selectedTemplateIds.splice(index, 1);
    }
    
    // Update overall selected templates
    this.updateSelectedTemplates();
    
    // Auto-expand the set if templates are selected
    if (group.selectedTemplateIds.length > 0) {
      group.isExpanded = true;
    }
    
    this.cdr.detectChanges();
  }

  isTemplateSelected(templateId: string, setId: string): boolean {
    const group = this.templateSetGroups.find(g => g.id === setId);
    return group?.selectedTemplateIds.includes(templateId) || false;
  }

  getSetSelectedCount(setId: string): number {
    const group = this.templateSetGroups.find(g => g.id === setId);
    return group?.selectedTemplateIds.length || 0;
  }

  updateSelectedTemplates(): void {
    const allSelected: Template[] = [];
    for (const group of this.templateSetGroups) {
      for (const templateId of group.selectedTemplateIds) {
        const template = group.templates.find(t => t.id === templateId);
        if (template) {
          allSelected.push(template);
        }
      }
    }
    this.selectedTemplates = allSelected;
    this.resetGenerationState();
    this.cdr.detectChanges();
  }

  getTotalSelectedCount(): number {
    return this.selectedTemplates.length;
  }

  isMultipleSelected(): boolean {
    return this.selectedTemplates.length > 1;
  }

  hasSelection(): boolean {
    return this.selectedTemplates.length > 0;
  }

  getFirstSelected(): Template | null {
    return this.selectedTemplates.length > 0 ? this.selectedTemplates[0] : null;
  }

  goToStep2() {
    if (this.hasSelection()) {
      this.step = 2;
      this.resetGenerationState();
      this.cdr.detectChanges();
    }
  }

  goToStep1() {
    this.step = 1;
    this.resetGenerationState();
    this.cdr.detectChanges();
  }

  resetGenerationState() {
    this.showDocumentPreview = false;
    this.previewData = {};
    this.generatedBlob = null;
    this.currentPreviewBlob = null;
    this.previewError = '';
    this.manualValues = {};
    this.showManualForm = false;
    this.instruction = '';
    if (this.docxPreviewContainer) {
      this.docxPreviewContainer.nativeElement.innerHTML = '';
    }
    this.cdr.detectChanges();
  }

  async updateLiveDocumentPreview(): Promise<void> {
    const selectedTemplate = this.getFirstSelected();
    if (!selectedTemplate) return;
    
    let finalInstruction = '';
    if (this.hasManualValues()) {
      const manualParts = [];
      for (const [key, value] of Object.entries(this.manualValues)) {
        if (value && value.trim()) {
          manualParts.push(`${key.replace(/_/g, ' ')} is ${value}`);
        }
      }
      if (manualParts.length > 0) {
        finalInstruction = manualParts.join(', ');
      }
    } else if (this.instruction.trim()) {
      finalInstruction = this.instruction;
    }
    
    if (!finalInstruction.trim()) return;
    
    this.isRenderingPreview = true;
    this.previewError = '';
    this.cdr.detectChanges();
    
    try {
      const blob = await this.generateService.generate(finalInstruction, selectedTemplate.id);
      
      if (blob.size === 0) {
        throw new Error('Generated file is empty');
      }
      
      this.currentPreviewBlob = blob;
      this.showDocumentPreview = true;
      this.cdr.detectChanges();
      
      if (this.docxPreviewContainer) {
        this.docxPreviewContainer.nativeElement.innerHTML = '';
      }
      
      setTimeout(async () => {
        if (this.docxPreviewContainer) {
          try {
            await renderAsync(blob, this.docxPreviewContainer.nativeElement, undefined, {
              className: 'docx-preview-wrapper',
              inWrapper: true,
              breakPages: true,
              renderHeaders: true,
              renderFooters: true
            });
            this.cdr.detectChanges();
          } catch (renderErr) {
            this.previewError = 'Could not render document.';
            this.cdr.detectChanges();
          }
          this.isRenderingPreview = false;
          this.cdr.detectChanges();
        }
      }, 100);
      
    } catch (err) {
      this.previewError = 'Failed to generate preview.';
      this.isRenderingPreview = false;
      this.cdr.detectChanges();
    }
  }

  updateManualValue(placeholder: string, event: any): void {
    this.manualValues[placeholder] = event.target.value;
    this.previewData[placeholder] = event.target.value;
    this.showManualForm = true;
    this.cdr.detectChanges();
    
    if (this.previewTimeout) clearTimeout(this.previewTimeout);
    this.previewTimeout = setTimeout(() => {
      if (!this.isMultipleSelected()) {
        this.updateLiveDocumentPreview();
      }
    }, 500);
  }

  async extractValuesWithAI() {
    const selectedTemplate = this.getFirstSelected();
    if (!selectedTemplate || !this.instruction.trim()) return;
    
    this.isPreviewing = true;
    this.cdr.detectChanges();
    
    try {
      const result = await this.generateService.preview(this.instruction, selectedTemplate.id);
      this.previewData = result.mapped_values;
      this.manualValues = { ...this.previewData };
      this.showManualForm = true;
      this.cdr.detectChanges();
      await this.updateLiveDocumentPreview();
    } catch (err) {
      console.error(err);
    } finally {
      this.isPreviewing = false;
      this.cdr.detectChanges();
    }
  }

  async downloadDocument() {
    const selectedTemplate = this.getFirstSelected();
    if (!selectedTemplate) return;
    
    let finalInstruction = this.instruction;
    if (this.hasManualValues() && !finalInstruction.trim()) {
      const manualParts = [];
      for (const [key, value] of Object.entries(this.manualValues)) {
        if (value && value.trim()) {
          manualParts.push(`${key.replace(/_/g, ' ')} is ${value}`);
        }
      }
      if (manualParts.length > 0) {
        finalInstruction = manualParts.join(', ');
      }
    }
    
    if (!finalInstruction.trim()) {
      alert('Please enter instruction or fill manual values');
      return;
    }
    
    this.isGeneratingForDownload = true;
    this.cdr.detectChanges();
    
    try {
      const blob = await this.generateService.generate(finalInstruction, selectedTemplate.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated_${selectedTemplate.filename}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download document.');
    } finally {
      this.isGeneratingForDownload = false;
      this.cdr.detectChanges();
    }
  }

  async bulkGenerateAndPreview() {
    if (!this.instruction.trim() && !this.hasManualValues()) {
      alert('Select templates and enter instruction or fill manual values');
      return;
    }
    
    this.isGeneratingBulk = true;
    
    try {
      const templateIds = this.selectedTemplates.map(t => t.id);
      let finalInstruction = this.instruction;
      
      if (!finalInstruction.trim() && this.hasManualValues()) {
        const manualParts = [];
        for (const [key, value] of Object.entries(this.manualValues)) {
          if (value && value.trim()) {
            manualParts.push(`${key.replace(/_/g, ' ')} is ${value}`);
          }
        }
        if (manualParts.length > 0) {
          finalInstruction = manualParts.join(', ');
        }
      }
      
      const blob = await this.generateService.bulkGenerate(finalInstruction, templateIds);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documents.zip';
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (err) {
      alert('Failed to generate documents');
    } finally {
      this.isGeneratingBulk = false;
      this.cdr.detectChanges();
    }
  }

  downloadFromPreview() {
    if (this.currentPreviewBlob && this.getFirstSelected()) {
      const url = URL.createObjectURL(this.currentPreviewBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated_${this.getFirstSelected()!.filename}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  copyText(text: string) {
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }
}