import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../../services/template';
import { Template } from '../../../models/template.model';

@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './template-detail.html',
  styleUrls: ['./template-detail.css']
})
export class TemplateDetail implements OnInit {
  template: Template | undefined;
  placeholders: string[] = [];
  isLoading = true;
  testInstruction = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: TemplateService
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadTemplate(id);
    }
  }

  async loadTemplate(id: string) {
    this.isLoading = true;
    this.template = this.templateService.getTemplate(id);
    if (this.template) {
      try {
        this.placeholders = await this.templateService.getPlaceholders(id);
      } catch (err) {
        console.error(err);
      }
    }
    this.isLoading = false;
  }

  async deleteTemplate() {
    if (this.template && confirm(`Delete "${this.template.filename}"?`)) {
      await this.templateService.deleteTemplate(this.template.id);
      this.router.navigate(['/templates']);
    }
  }

  goGenerate() {
    if (this.template) {
      this.router.navigate(['/generate'], { queryParams: { templateId: this.template.id } });
    }
  }

  quickTest() {
    if (this.template && this.testInstruction.trim()) {
      this.router.navigate(['/generate'], { 
        queryParams: { templateId: this.template.id, instruction: this.testInstruction }
      });
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  }

  copyText(text: string) {
    navigator.clipboard.writeText(text);
  }
}