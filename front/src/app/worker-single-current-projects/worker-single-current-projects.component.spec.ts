import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkerSingleCurrentProjectsComponent } from './worker-single-current-projects.component';

describe('WorkerSingleCurrentProjectsComponent', () => {
  let component: WorkerSingleCurrentProjectsComponent;
  let fixture: ComponentFixture<WorkerSingleCurrentProjectsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkerSingleCurrentProjectsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WorkerSingleCurrentProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
