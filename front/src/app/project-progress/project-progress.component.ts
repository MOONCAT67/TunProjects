import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { ProjectTasksService, MainTask, SubTask, WorkerProfileResponse, UserProfile, WorkerJobProfile } from '../services/project-tasks.service';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-project-progress',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './project-progress.component.html',
  styleUrls: ['./project-progress.component.css']
})
export class ProjectProgressComponent implements OnInit {
  mainTasks: MainTask[] = [];
  selectedTask: MainTask | null = null;
  selectedSubtask: SubTask | null = null;
  hoveredTask: MainTask | null = null;
  isLoading = true;
  error: string | null = null;
  totalProgress = 0;
  workerProfiles: { [workerId: number]: UserProfile } = {};
  workerJobs: { [workerId: number]: WorkerJobProfile[] } = {};
  currentPhaseTask: MainTask | null = null;

  constructor(
    private route: ActivatedRoute,
    private projectTasksService: ProjectTasksService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const projectId = +params['id'];
      this.loadProjectTasks(projectId);
      this.loadCurrentPhaseTask(projectId);
    });
  }

  private loadCurrentPhaseTask(projectId: number): void {
    this.projectTasksService.getCurrentPhaseTasks(projectId).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          this.currentPhaseTask = response.data[0];
        }
      },
      error: (error) => {
        console.error('Error loading current phase task:', error);
      }
    });
  }

  loadProjectTasks(projectId: number) {
    this.isLoading = true;
    this.error = null;
    this.projectTasksService.getProjectTasks(projectId).pipe(
      tap(response => {
         if (response.data && Array.isArray(response.data)) {
           this.mainTasks = response.data;
         } else {
           this.mainTasks = [];
         }
      }),
      switchMap(() => {
         const workerIdsToFetch = new Set<number>();
         this.mainTasks.forEach(task => {
           task.subtasks.forEach(subtask => {
             if (subtask.assigned_to && !this.workerProfiles[subtask.assigned_to]) {
               workerIdsToFetch.add(subtask.assigned_to);
             }
           });
         });

         if (workerIdsToFetch.size > 0) {
            const profileRequests = Array.from(workerIdsToFetch).map(workerId =>
              this.projectTasksService.getWorkerProfile(workerId).pipe(
                 tap(profileResponse => {
                    if (profileResponse.data?.user) {
                       this.workerProfiles[workerId] = profileResponse.data.user;
                       this.workerJobs[workerId] = profileResponse.data.jobs || [];
                    }
                 }),
                 catchError(err => {
                    console.error(`Failed to load profile for worker ${workerId}:`, err);
                    return of(null);
                 })
              )
            );
            return forkJoin(profileRequests).pipe(map(() => this.mainTasks));
         } else {
            return of(this.mainTasks);
         }
      })
    ).subscribe({
      next: (mainTasks) => {
        this.mainTasks = mainTasks;
        this.calculateTotalProgress();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load project tasks or worker profiles. Please try again later.';
        this.isLoading = false;
        console.error('Loading error:', err);
      }
    });
  }

  calculateTotalProgress() {
    if (this.mainTasks.length === 0) {
      this.totalProgress = 0;
      return;
    }
    const total = this.mainTasks.reduce((sum, task) => sum + task.progress_percentage, 0);
    this.totalProgress = Math.round(total / this.mainTasks.length);
  }

  selectTask(task: MainTask) {
    this.selectedTask = task;
    this.selectedSubtask = null;
  }

  selectSubtask(subtask: SubTask) {
    this.selectedSubtask = subtask;
  }

  getWorkerProfile(workerId: number | undefined): UserProfile | undefined {
     if (workerId === undefined) return undefined;
     return this.workerProfiles[workerId];
  }

  getWorkerJobs(workerId: number | undefined): WorkerJobProfile[] | undefined {
    if (workerId === undefined) return undefined;
    return this.workerJobs[workerId];
  }

  showTaskTooltip(task: MainTask) {
    // Implement tooltip logic if needed
  }

  hideTaskTooltip() {
    // Implement tooltip hide logic if needed
  }
}
