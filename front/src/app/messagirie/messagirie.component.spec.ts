import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessagirieComponent } from './messagirie.component';

describe('MessagirieComponent', () => {
  let component: MessagirieComponent;
  let fixture: ComponentFixture<MessagirieComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessagirieComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MessagirieComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
