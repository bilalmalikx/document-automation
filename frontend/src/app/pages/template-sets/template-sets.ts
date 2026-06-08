import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { TemplateService } from '../../services/template';
import { ToastService } from '../../services/toast';
import { TemplateSet } from '../../models/template-set.model';

@Component({
  selector: 'app-template-sets',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './template-sets.html',
  styleUrl: './template-sets.css',
})
export class TemplateSets implements OnInit {
  private templateSetService = inject(TemplateSetService);
  private templateService = inject(TemplateService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  templateSets: TemplateSet[] = [];
  filteredSets: TemplateSet[] = [];
  isLoading = true;
  showCreateModal = false;
  newSetName = '';
  newSetDescription = '';
  searchQuery = '';

  totalTemplates = 0;
  totalPlaceholders = 0;
  templatePlaceholderCounts: Map<string, number> = new Map();

  ngOnInit(): void {
    this.loadTemplateSets();
  }

  loadTemplateSets(): void {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    this.templateSetService.getTemplateSets().subscribe({
      next: async (res) => {
        this.templateSets = res.template_sets;
        this.filteredSets = [...this.templateSets];
        
        // Calculate totals
        await this.calculateTotals();
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toast.show('error', 'Error', 'Failed to load template sets');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  async calculateTotals(): Promise<void> {
    let totalTemplatesCount = 0;
    let totalPlaceholdersCount = 0;
    
    for (const set of this.templateSets) {
      try {
        const detail = await this.templateSetService.getTemplateSet(set.id).toPromise();
        const templates = detail?.templates || [];
        const setTemplateCount = templates.length;
        totalTemplatesCount += setTemplateCount;
        
        // Calculate placeholders for each template in this set
        let setPlaceholdersCount = 0;
        for (const template of templates) {
          if (template.placeholders && template.placeholders.length > 0) {
            setPlaceholdersCount += template.placeholders.length;
          } else {
            // Fetch placeholders if not already in template object
            try {
              const placeholders = await this.templateService.getPlaceholders(template.id);
              setPlaceholdersCount += placeholders.length;
              template.placeholders = placeholders;
            } catch (err) {
              console.error(`Failed to get placeholders for ${template.id}`, err);
            }
          }
        }
        
        totalPlaceholdersCount += setPlaceholdersCount;
        this.templatePlaceholderCounts.set(set.id, setPlaceholdersCount);
        
      } catch (err) {
        console.error(`Failed to load details for set ${set.id}`, err);
      }
    }
    
    this.totalTemplates = totalTemplatesCount;
    this.totalPlaceholders = totalPlaceholdersCount;
    this.cdr.detectChanges();
  }

  getTemplateCountForSet(setId: string): number {
    const set = this.templateSets.find(s => s.id === setId);
    if (set && (set as any).template_count !== undefined) {
      return (set as any).template_count;
    }
    return this.templatePlaceholderCounts.has(setId) ? 
      (this.templatePlaceholderCounts.get(setId) || 0) > 0 ? 
        Math.ceil((this.templatePlaceholderCounts.get(setId) || 0) / 10) : 0 : 0;
  }

  getPlaceholderCountForSet(setId: string): number {
    return this.templatePlaceholderCounts.get(setId) || 0;
  }

  filterSets(): void {
    if (!this.searchQuery.trim()) {
      this.filteredSets = [...this.templateSets];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredSets = this.templateSets.filter(set => 
        set.name.toLowerCase().includes(query) ||
        (set.description && set.description.toLowerCase().includes(query))
      );
    }
    this.cdr.detectChanges();
  }

  openTemplateSet(id: string): void {
    console.log('Opening set with ID:', id);
    if (id) {
      this.router.navigate(['/template-sets', id]);
    } else {
      this.toast.show('error', 'Error', 'Invalid template set');
    }
  }

  openCreateModal(): void {
    this.newSetName = '';
    this.newSetDescription = '';
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createTemplateSet(): void {
    if (!this.newSetName.trim()) {
      this.toast.show('error', 'Validation', 'Template set name is required');
      return;
    }

    this.templateSetService.createTemplateSet({
      name: this.newSetName,
      description: this.newSetDescription
    }).subscribe({
      next: () => {
        this.toast.show('success', 'Created', 'Template set created successfully');
        this.closeCreateModal();
        this.loadTemplateSets();
      },
      error: (err) => {
        console.error(err);
        this.toast.show('error', 'Error', 'Failed to create template set');
      }
    });
  }

  deleteTemplateSet(id: string, name: string): void {
    if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
      this.templateSetService.deleteTemplateSet(id).subscribe({
        next: () => {
          this.toast.show('success', 'Deleted', 'Template set deleted');
          this.loadTemplateSets();
        },
        error: (err) => {
          console.error(err);
          this.toast.show('error', 'Error', 'Failed to delete template set');
        }
      });
    }
  }
}