import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatingTasksComponent } from './creating-tasks.component';

describe('CreatingTasksComponent', () => {
  let component: CreatingTasksComponent;
  let fixture: ComponentFixture<CreatingTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatingTasksComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreatingTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
