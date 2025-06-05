import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectListElementComponent } from './project-list-element.component';

describe('ProjectListElementComponent', () => {
  let component: ProjectListElementComponent;
  let fixture: ComponentFixture<ProjectListElementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectListElementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProjectListElementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
