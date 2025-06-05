import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TeamService } from '../services/team.service';
import { ProjectTasksService } from '../services/project-tasks.service';
import { AuthService } from '../services/authService';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-teamtask',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teamtask.component.html',
  styleUrl: './teamtask.component.css',
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*', padding: '15px' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
    trigger('fadeIn', [
      state('void', style({ opacity: 0 })),
      transition(':enter, :leave', [ animate('0.5s ease-in-out') ]),
    ]),
  ],
})
export class TeamtaskComponent implements OnInit {
  projects: any[] = [];
  loading = true;
  error: string | null = null;
  selectedSubtask: any | null = null; // Property to track selected subtask
  teamId!: number; // Keep teamId from route

  constructor(private route: ActivatedRoute, private teamService: TeamService, private projectTasksService: ProjectTasksService, private authService: AuthService) {} // Inject AuthService

  ngOnInit() {
    this.teamId = +(this.route.snapshot.paramMap.get('teamId') || 0);
    const userId = this.authService.getUserId(); // Get userId from AuthService

    if (this.teamId && userId) { // Use this.teamId
      this.teamService.getUserTeamSubtasks(this.teamId, userId).subscribe({
        next: (res) => {
          this.projects = res.data || [];
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load subtasks.';
          this.loading = false;
        }
      });
    } else {
      this.error = 'Invalid team or user ID.';
      this.loading = false;
    }
  }

  // Method to handle subtask click
  selectSubtask(subtask: any): void {
    this.selectedSubtask = this.selectedSubtask === subtask ? null : subtask;
  }

  // Method to accept subtask (change status to in progress)
  acceptSubtask(subtask: any): void {
    const userId = this.authService.getUserId(); // Get userId from AuthService
    if (userId) {
      this.projectTasksService.updateSubtaskStatus(subtask.id, 'in progress', userId).subscribe({
        next: () => {
          this.updateSubtaskStatusLocally(subtask.id, 'in progress');
          this.selectedSubtask = null; // Close details after action
        },
        error: (err) => {
          console.error('Error accepting subtask:', err);
          alert('Failed to accept subtask.');
        }
      });
    } else {
       alert('User not authenticated.');
    }
  }

  // Method to finish subtask (change status to completed)
  finishSubtask(subtask: any): void {
    const userId = this.authService.getUserId(); // Get userId from AuthService
     if (userId) {
      this.projectTasksService.updateSubtaskStatus(subtask.id, 'completed', userId).subscribe({
        next: () => {
          this.updateSubtaskStatusLocally(subtask.id, 'completed');
          this.selectedSubtask = null; // Close details after action
        },
        error: (err) => {
          console.error('Error finishing subtask:', err);
          alert('Failed to finish subtask.');
        }
      });
     } else {
        alert('User not authenticated.');
     }
  }

  // Helper method to update subtask status in the local projects array
  updateSubtaskStatusLocally(subtaskId: number, status: string): void {
    for (const project of this.projects) {
      for (const mainTask of project.main_tasks) {
        const subtask = mainTask.subtasks.find((st: any) => st.id === subtaskId);
        if (subtask) {
          subtask.status = status;
          // You might want to update progress_percentage here too if needed
          break; // Subtask found, no need to continue searching
        }
      }
    }
  }
}
