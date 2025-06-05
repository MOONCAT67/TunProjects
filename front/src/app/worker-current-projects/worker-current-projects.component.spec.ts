import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkerCurrentProjectsComponent } from './worker-current-projects.component';

describe('WorkerCurrentProjectsComponent', () => {
  let component: WorkerCurrentProjectsComponent;
  let fixture: ComponentFixture<WorkerCurrentProjectsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkerCurrentProjectsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WorkerCurrentProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
