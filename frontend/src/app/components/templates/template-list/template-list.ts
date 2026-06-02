import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Template } from '../../../models/template.model';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './template-list.html',
  styleUrls: ['./template-list.css']
})
export class TemplateList {
  templates = input<Template[]>([]);
  viewMode = input<'grid' | 'list'>('grid');
  searchQuery = input<string>('');
  deleteTemplate = output<string>();
  viewPlaceholders = output<string>();

  constructor(private router: Router) {}

  get filteredTemplates(): Template[] {
    const query = this.searchQuery()?.toLowerCase() || '';
    if (!query) return this.templates();
    return this.templates().filter(t => 
      t.filename.toLowerCase().includes(query) ||
      t.original_filename.toLowerCase().includes(query)
    );
  }

  onDelete(id: string, event: Event) {
    event.stopPropagation();
    this.deleteTemplate.emit(id);
  }

  onViewPlaceholders(id: string, event: Event) {
    event.stopPropagation();
    this.viewPlaceholders.emit(id);
  }

  onTemplateClick(id: string) {
    this.router.navigate(['/templates', id]);
  }

  onGenerate(id: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/generate'], { queryParams: { templateId: id } });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr.slice(0, 10);
    }
  }
}