export class Document {
  name: string;
  pages?: number;
  chunks?: number;
  uploadDate: Date;

  constructor(name: string, pages?: number, chunks?: number, uploadDate: Date = new Date()) {
    this.name = name;
    this.pages = pages;
    this.chunks = chunks;
    this.uploadDate = uploadDate;
  }

  get displayName(): string {
    return this.name.length > 40 ? this.name.substring(0, 37) + '...' : this.name;
  }

  get summary(): string {
    return `${this.pages || '?'} pages · ${this.chunks || '?'} chunks`;
  }
}