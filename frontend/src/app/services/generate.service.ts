// import { Injectable, inject } from '@angular/core';
// import { Api } from './api';
// import { PreviewRequest, PreviewResponse, GenerateRequest } from '../models/document.model';
// import { lastValueFrom } from 'rxjs';

// @Injectable({ providedIn: 'root' })
// export class GenerateService {
//   private apiService = inject(Api);

//   async preview(instruction: string, templateId: string): Promise<PreviewResponse> {
//     const request: PreviewRequest = { template_id: templateId, instruction };
//     return await lastValueFrom(this.apiService.previewDocument(request));
//   }

//   async generate(instruction: string, templateId: string): Promise<Blob> {
//     const request: GenerateRequest = { template_id: templateId, instruction };
//     return await lastValueFrom(this.apiService.generateDocument(request));
//   }
// }