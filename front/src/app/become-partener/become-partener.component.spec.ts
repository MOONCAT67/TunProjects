import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BecomePartenerComponent } from './become-partener.component';

describe('BecomePartenerComponent', () => {
  let component: BecomePartenerComponent;
  let fixture: ComponentFixture<BecomePartenerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BecomePartenerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BecomePartenerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
