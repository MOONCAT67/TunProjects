import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PainterComponent } from './painter.component';

describe('PainterComponent', () => {
  let component: PainterComponent;
  let fixture: ComponentFixture<PainterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PainterComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PainterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
