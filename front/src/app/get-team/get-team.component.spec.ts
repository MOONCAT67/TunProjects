import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GetTeamComponent } from './get-team.component';

describe('GetTeamComponent', () => {
  let component: GetTeamComponent;
  let fixture: ComponentFixture<GetTeamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GetTeamComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GetTeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
