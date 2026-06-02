import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropDirective } from '../shared/directives/drag-drop';

@Component({
  selector: 'app-file-upload',
  imports: [CommonModule, DragDropDirective],
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.css',
})
export class FileUploadComponent {
  @Input() isUploading = false;
  @Input() uploadProgress = 0;
  @Input() uploadError: string | null = null;
  @Output() onFileSelected = new EventEmitter<Event>();
  @Output() onFileDropped = new EventEmitter<File>();
}
