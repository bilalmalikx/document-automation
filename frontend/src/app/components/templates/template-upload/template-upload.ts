import { Component, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TemplateService } from '../../../services/template';

@Component({
  selector: 'app-template-upload',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './template-upload.html',
  styleUrls: ['./template-upload.css']
})
export class TemplateUpload {
  templateName = '';
  selectedFile: File | null = null;
  isDragging = false;
  isUploading = false;
  uploadProgress = 0;
  errorMessage = '';
  showSuccess = false;

  uploaded = output<void>();

  constructor(private templateService: TemplateService) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
      this.errorMessage = '';
      this.showSuccess = false;
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.errorMessage = '';
      this.showSuccess = false;
    }
  }

  async upload() {
    if (!this.templateName.trim()) {
      this.errorMessage = 'Please enter a template name';
      return;
    }
    if (!this.selectedFile) {
      this.errorMessage = 'Please select a file';
      return;
    }
    if (!this.selectedFile.name.endsWith('.docx')) {
      this.errorMessage = 'Only .docx files are supported';
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';
    this.showSuccess = false;

    // Simulate progress
    const interval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress = Math.min(this.uploadProgress + 10, 90);
      }
    }, 200);

    try {
      await this.templateService.uploadTemplate(this.templateName, this.selectedFile);
      
      clearInterval(interval);
      this.uploadProgress = 100;
      
      // Show success message
      this.showSuccess = true;
      
      // Reset form after 1.5 seconds
      setTimeout(() => {
        this.templateName = '';
        this.selectedFile = null;
        this.uploadProgress = 0;
        this.isUploading = false;
        this.showSuccess = false;
        
        // Clear file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        
        // Refresh template list
        this.uploaded.emit();
      }, 1500);
      
    } catch (err: any) {
      clearInterval(interval);
      this.errorMessage = err.message || 'Upload failed. Please try again.';
      this.isUploading = false;
      this.uploadProgress = 0;
      console.error('Upload error:', err);
    }
  }

  removeFile() {
    this.selectedFile = null;
    this.errorMessage = '';
    this.showSuccess = false;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}