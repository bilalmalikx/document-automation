import { Component, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { TemplateService } from '../../services/template';
import { GenerateService } from '../../services/generate';
import { Template } from '../../models/template.model';
import { renderAsync } from 'docx-preview';

@Component({
  selector: 'app-generate-page',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './generate-page.html',
  styleUrls: ['./generate-page.css']
})
export class GeneratePage implements OnInit {
  @ViewChild('docxPreviewContainer') docxPreviewContainer!: ElementRef;
  
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
  
  multiplePreviewData: Array<{ templateId: string, templateName: string, placeholders: Record<string, string> }> = [];
  isPreviewingMultiple = false;
  
  manualValues: Record<string, string> = {};
  showManualForm = false;
  multiManualValues: Record<string, Record<string, string>> = {};
  
  // Combined placeholders for all templates (one section)
  allPlaceholders: Record<string, string> = {};
  
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

  getManualValuesCount(): number {
    return Object.keys(this.manualValues).length;
  }

  getFilledManualValuesCount(): number {
    return Object.keys(this.manualValues).filter(k => this.manualValues[k]).length;
  }

  getManualValuesEntries(): Array<{key: string, value: string}> {
    return Object.entries(this.manualValues).map(([key, value]) => ({ key, value }));
  }

  hasManualValues(): boolean {
    return Object.keys(this.manualValues).length > 0;
  }

  getPlaceholderCount(placeholders: Record<string, string>): number {
    return Object.keys(placeholders).length;
  }

  getPlaceholderLabel(placeholder: string): string {
    return placeholder
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Get ALL placeholders combined from ALL selected templates
  getAllCombinedPlaceholders(): string[] {
    const templates = this.templateService.selectedTemplates();
    if (templates.length === 0) return [];
    
    const combined = new Set<string>();
    for (const template of templates) {
      for (const ph of template.placeholders) {
        combined.add(ph);
      }
    }
    return Array.from(combined);
  }

  // Get value for a placeholder (from any template)
  getCombinedValue(placeholder: string): string {
    const templates = this.templateService.selectedTemplates();
    for (const template of templates) {
      const val = this.multiManualValues[template.id]?.[placeholder];
      if (val) return val;
    }
    return this.manualValues[placeholder] || '';
  }

  // Update value for ALL templates (applies to all)
  updateCombinedValue(placeholder: string, event: any): void {
    const value = event.target.value;
    const templates = this.templateService.selectedTemplates();
    
    // Update for all templates
    for (const template of templates) {
      if (!this.multiManualValues[template.id]) {
        this.multiManualValues[template.id] = {};
      }
      this.multiManualValues[template.id][placeholder] = value;
    }
    
    // Also update single mode values
    this.manualValues[placeholder] = value;
    this.previewData[placeholder] = value;
    
    this.cdr.detectChanges();
    
    // Debounced preview update
    if (this.previewTimeout) clearTimeout(this.previewTimeout);
    this.previewTimeout = setTimeout(() => {
      this.renderAllDocumentPreviews();
    }, 500);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    public templateService: TemplateService,
    private generateService: GenerateService
  ) {}

  ngOnInit() {
    this.templateService.loadTemplates();
    const templateId = this.route.snapshot.queryParamMap.get('templateId');
    const savedInstruction = this.route.snapshot.queryParamMap.get('instruction');
    if (templateId) {
      const template = this.templateService.getTemplate(templateId);
      if (template) {
        this.templateService.toggleSelection(template);
        this.step = 2;
      }
    }
    if (savedInstruction) {
      this.instruction = savedInstruction;
    }
  }

  toggleTemplateSelection(template: Template): void {
    this.templateService.toggleSelection(template);
    this.resetState();
    this.cdr.detectChanges();
  }

  clearTemplateSelection(): void {
    this.templateService.clearSelection();
    this.resetState();
    this.cdr.detectChanges();
  }

  goToStep2() {
    if (this.templateService.hasSelection()) {
      this.step = 2;
      this.resetState();
      this.cdr.detectChanges();
    }
  }

  goToStep1() {
    this.step = 1;
    this.resetState();
    this.cdr.detectChanges();
  }

  resetState() {
    this.showDocumentPreview = false;
    this.previewData = {};
    this.multiplePreviewData = [];
    this.generatedBlob = null;
    this.currentPreviewBlob = null;
    this.previewError = '';
    this.manualValues = {};
    this.multiManualValues = {};
    this.showManualForm = false;
    this.allPlaceholders = {};
    if (this.docxPreviewContainer) {
      this.docxPreviewContainer.nativeElement.innerHTML = '';
    }
    this.cdr.detectChanges();
  }

  async renderAllDocumentPreviews(): Promise<void> {
    const templates = this.templateService.selectedTemplates();
    if (templates.length === 0) return;
    
    const allPreviewsContainer = document.getElementById('all-previews-container');
    if (!allPreviewsContainer) return;
    
    allPreviewsContainer.innerHTML = '';
    
    // Use a Set to track rendered templates (prevent duplicates)
    const renderedIds = new Set<string>();
    
    for (const template of templates) {
      if (renderedIds.has(template.id)) continue;
      renderedIds.add(template.id);
      
      // Build instruction from ALL values
      const allValues: Record<string, string> = {};
      const combinedPlaceholders = this.getAllCombinedPlaceholders();
      
      for (const ph of combinedPlaceholders) {
        const val = this.getCombinedValue(ph);
        if (val) allValues[ph] = val;
      }
      
      const parts = [];
      for (const [key, value] of Object.entries(allValues)) {
        if (value) {
          parts.push(`${key.replace(/_/g, ' ')} is ${value}`);
        }
      }
      
      let finalInstruction = parts.length > 0 ? parts.join(', ') : this.instruction;
      if (!finalInstruction.trim()) continue;
      
      try {
        const blob = await this.generateService.generate(finalInstruction, template.id);
        const previewCard = document.createElement('div');
        previewCard.className = 'multi-preview-card-item';
        previewCard.innerHTML = `
          <div class="preview-card-header">
            <div class="preview-card-title">
              <span>📄</span>
              <span>${this.escapeHtml(template.filename)}</span>
            </div>
            <span class="preview-card-badge">${template.placeholder_count} placeholders</span>
          </div>
          <div class="preview-card-body">
            <div class="docx-preview-inline" data-id="${template.id}"></div>
          </div>
        `;
        allPreviewsContainer.appendChild(previewCard);
        
        const inlineContainer = previewCard.querySelector(`.docx-preview-inline[data-id="${template.id}"]`) as HTMLElement;
        if (inlineContainer) {
          await renderAsync(blob, inlineContainer, undefined, {
            className: 'docx-preview-wrapper',
            inWrapper: true,
            breakPages: true,
            renderHeaders: true,
            renderFooters: true
          });
        }
      } catch (err) {
        console.error(`Error rendering preview:`, err);
      }
    }
  }

  escapeHtml(str: string): string {
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  async updateLiveDocumentPreview(): Promise<void> {
    const selectedTemplate = this.templateService.getFirstSelected();
    if (!selectedTemplate) return;
    
    let finalInstruction = '';
    if (this.hasManualValues()) {
      const manualParts = [];
      for (const [key, value] of Object.entries(this.manualValues)) {
        if (value) {
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
      if (this.templateService.isMultipleSelected()) {
        this.renderAllDocumentPreviews();
      } else {
        this.updateLiveDocumentPreview();
      }
    }, 500);
  }

  async extractValuesWithAI() {
    const selectedTemplate = this.templateService.getFirstSelected();
    if (!selectedTemplate || !this.instruction.trim()) return;
    
    this.isPreviewing = true;
    this.cdr.detectChanges();
    
    try {
      const result = await this.generateService.preview(this.instruction, selectedTemplate.id);
      this.previewData = result.mapped_values;
      this.manualValues = { ...this.previewData };
      this.showManualForm = true;
      this.cdr.detectChanges();
      
      // Also update multi values
      const templates = this.templateService.selectedTemplates();
      for (const template of templates) {
        if (!this.multiManualValues[template.id]) {
          this.multiManualValues[template.id] = {};
        }
        for (const [key, value] of Object.entries(this.previewData)) {
          this.multiManualValues[template.id][key] = value;
        }
      }
      
      await this.updateLiveDocumentPreview();
      
    } catch (err) {
      console.error(err);
    } finally {
      this.isPreviewing = false;
      this.cdr.detectChanges();
    }
  }

  async previewMultipleTemplates(): Promise<void> {
    this.isPreviewingMultiple = true;
    this.cdr.detectChanges();
    
    try {
      const templates = this.templateService.selectedTemplates();
      const previewResults = [];
      
      for (const template of templates) {
        const manualVals = this.multiManualValues[template.id] || {};
        let mappedValues: Record<string, string> = {};
        
        if (this.instruction.trim()) {
          const result = await this.generateService.preview(this.instruction, template.id);
          mappedValues = result.mapped_values;
        }
        
        if (manualVals) {
          mappedValues = { ...mappedValues, ...manualVals };
        }
        
        previewResults.push({
          templateId: template.id,
          templateName: template.filename,
          placeholders: mappedValues
        });
      }
      
      this.multiplePreviewData = previewResults;
      this.cdr.detectChanges();
      await this.renderAllDocumentPreviews();
      
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      this.isPreviewingMultiple = false;
      this.cdr.detectChanges();
    }
  }

  async downloadDocument() {
    const selectedTemplate = this.templateService.getFirstSelected();
    if (!selectedTemplate) return;
    
    let finalInstruction = this.instruction;
    if (this.hasManualValues() && !finalInstruction.trim()) {
      const manualParts = [];
      for (const [key, value] of Object.entries(this.manualValues)) {
        if (value) {
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
    if (!this.instruction.trim() && !Object.keys(this.multiManualValues).length) {
      alert('Select templates and enter instruction or fill manual values');
      return;
    }
    
    this.isGeneratingBulk = true;
    
    try {
      const templateIds = this.templateService.getSelectedIds();
      let finalInstruction = this.instruction;
      
      if (!finalInstruction.trim() && Object.keys(this.multiManualValues).length > 0) {
        const firstTemplateId = templateIds[0];
        const manualVals = this.multiManualValues[firstTemplateId];
        if (manualVals) {
          const manualParts = [];
          for (const [key, value] of Object.entries(manualVals)) {
            if (value) {
              manualParts.push(`${key.replace(/_/g, ' ')} is ${value}`);
            }
          }
          if (manualParts.length > 0) {
            finalInstruction = manualParts.join(', ');
          }
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
    if (this.currentPreviewBlob && this.templateService.getFirstSelected()) {
      const url = URL.createObjectURL(this.currentPreviewBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated_${this.templateService.getFirstSelected()!.filename}`;
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