import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientProjectApplicationsComponent } from './client-project-applications.component';

describe('ClientProjectApplicationsComponent', () => {
  let component: ClientProjectApplicationsComponent;
  let fixture: ComponentFixture<ClientProjectApplicationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientProjectApplicationsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ClientProjectApplicationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
