import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateSetService } from '../../services/template-set';
import { ToastService } from '../../services/toast';
import { TemplateSet } from '../../models/template-set.model';
import { TemplateSetCard } from '../../components/template-sets/template-set-card/template-set-card';

@Component({
  selector: 'app-template-sets',
  imports: [CommonModule,RouterModule,FormsModule,TemplateSetCard],
  templateUrl: './template-sets.html',
  styleUrl: './template-sets.css',
})
export class TemplateSets implements OnInit {
  private templateSetService = inject(TemplateSetService);
  private toast = inject(ToastService);

  templateSets: TemplateSet[] = [];
  isLoading = true;
  showCreateModal = false;
  newSetName = '';
  newSetDescription = '';

  ngOnInit(): void {
    this.loadTemplateSets();
  }

  loadTemplateSets(): void {
    this.isLoading = true;
    this.templateSetService.getTemplateSets().subscribe({
      next: (res) => {
        this.templateSets = res.template_sets;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.toast.show('error', 'Error', 'Failed to load template sets');
        this.isLoading = false;
      }
    });
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