import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
  standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }
    
    let stringValue = typeof value === 'string' ? value : String(value);
    
    // Step 1: First convert \n to <br>
    let withBreaks = stringValue.replace(/\n/g, '<br>');
    
    // Step 2: Then clean other unwanted content
    let cleaned = withBreaks
      .replace(/SafeValue must use \[property]=binding: /g, '')
      .replace(/\(see https:\/\/angular\.dev\/best-practices\/security[^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Step 3: Fix multiple <br> tags
    cleaned = cleaned.replace(/(<br>\s*){2,}/g, '<br><br>');
    
    // Mark as trusted HTML
    return this.sanitizer.bypassSecurityTrustHtml(cleaned);
  }
}