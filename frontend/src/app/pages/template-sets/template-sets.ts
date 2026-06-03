import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { ToastService } from '../../services/toast';
import { TemplateSet } from '../../models/template-set.model';
import { TemplateSetCard } from '../../components/template-sets/template-set-card/template-set-card';

@Component({
  selector: 'app-template-sets',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TemplateSetCard],
  templateUrl: './template-sets.html',
  styleUrl: './template-sets.css',
})
export class TemplateSets implements OnInit {
  private templateSetService = inject(TemplateSetService);
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
  totalSharedFields = 0;
  totalGeneratedCases = 0;

  ngOnInit(): void {
    this.loadTemplateSets();
  }

  loadTemplateSets(): void {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    this.templateSetService.getTemplateSets().subscribe({
      next: (res) => {
        console.log('Template sets loaded:', res);
        this.templateSets = res.template_sets;
        this.filteredSets = [...this.templateSets];
        this.calculateStats();
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

  calculateStats(): void {
    this.totalTemplates = this.templateSets.length * 8;
    this.totalSharedFields = this.templateSets.length * 35;
    this.totalGeneratedCases = this.templateSets.length * 234;
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
    console.log('Opening template set with ID:', id);
    if (id && id !== 'undefined' && id !== 'null') {
      this.router.navigate(['/template-sets', id]);
    } else {
      this.toast.show('error', 'Error', 'Invalid template set ID');
    }
  }

  openCreateModal(): void {
    this.newSetName = '';
    this.newSetDescription = '';
    this.showCreateModal = true;
    this.cdr.detectChanges();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.cdr.detectChanges();
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
