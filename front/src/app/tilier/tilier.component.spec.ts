import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TilierComponent } from './tilier.component';

describe('TilierComponent', () => {
  let component: TilierComponent;
  let fixture: ComponentFixture<TilierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TilierComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TilierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
