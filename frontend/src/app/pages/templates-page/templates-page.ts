import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../services/template';
import { TemplateUpload } from '../../components/templates/template-upload/template-upload';
import { TemplateList } from '../../components/templates/template-list/template-list';
import { Modal } from '../../components/shared/modal/modal';

@Component({
  selector: 'app-templates-page',
  standalone: true,
  imports: [FormsModule, TemplateUpload, TemplateList, Modal],
  templateUrl: './templates-page.html',
  styleUrls: ['./templates-page.css']
})
export class TemplatesPage implements OnInit {
  viewMode: 'grid' | 'list' = 'grid';
  searchQuery = '';
  deleteModalOpen = false;
  templateToDelete: string | null = null;

  constructor(public templateService: TemplateService) {}

  ngOnInit() {
    this.templateService.loadTemplates();
  }

  setViewMode(mode: 'grid' | 'list') {
    this.viewMode = mode;
    localStorage.setItem('templateViewMode', mode);
  }

  onSearch(query: string) {
    this.searchQuery = query;
  }

  confirmDelete(id: string) {
    this.templateToDelete = id;
    this.deleteModalOpen = true;
  }

  async deleteConfirmed() {
    if (this.templateToDelete) {
      await this.templateService.deleteTemplate(this.templateToDelete);
      this.deleteModalOpen = false;
      this.templateToDelete = null;
    }
  }

  onUploadComplete() {
    this.templateService.loadTemplates();
  }
}