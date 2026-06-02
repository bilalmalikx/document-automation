import { TestBed } from '@angular/core/testing';

import { Template } from './template';

describe('Template', () => {
  let service: Template;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Template);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
