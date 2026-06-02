import { TestBed } from '@angular/core/testing';

import { Generate } from './generate';

describe('Generate', () => {
  let service: Generate;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Generate);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
