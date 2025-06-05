import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkerContractSignComponent } from './worker-contract-sign.component';

describe('WorkerContractSignComponent', () => {
  let component: WorkerContractSignComponent;
  let fixture: ComponentFixture<WorkerContractSignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkerContractSignComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WorkerContractSignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
