import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionInput } from './question-input';

describe('QuestionInput', () => {
  let component: QuestionInput;
  let fixture: ComponentFixture<QuestionInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionInput]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
