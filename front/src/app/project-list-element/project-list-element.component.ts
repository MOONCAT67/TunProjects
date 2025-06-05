import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Project } from '../models/project.model';

@Component({
  selector: 'app-project-list-element',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-list-element.component.html',
  styleUrls: ['./project-list-element.component.css']
})
export class ProjectListElementComponent {
  @Input() project!: Project;

  get formattedBudget(): string {
    return parseFloat(this.project.budget).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
  }

  get formattedDeadline(): string {
    return new Date(this.project.deadline).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  get daysLeft(): number {
    const deadline = new Date(this.project.deadline);
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get applicationCount(): number {
    return this.project.total_applications ?? this.project.application_count ?? 0;
  }
}
