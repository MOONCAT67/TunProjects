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
  taskProgress: { [taskId: number]: number } = {};

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

  calculateTaskProgress(task: MainTask): number {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    
    const completedSubtasks = task.subtasks.filter(subtask => subtask.status === 'completed').length;
    return (completedSubtasks / task.subtasks.length) * 100;
  }

  loadProjectTasks(projectId: number) {
    this.isLoading = true;
    this.error = null;
    this.projectTasksService.getProjectTasks(projectId).pipe(
      tap(response => {
         if (response.data && Array.isArray(response.data)) {
           this.mainTasks = response.data;
           // Calculate progress for each task
           this.mainTasks.forEach(task => {
             this.taskProgress[task.id] = this.calculateTaskProgress(task);
             console.log(`Task '${task.title}' (ID: ${task.id}) - Calculated Subtask Progress: ${this.taskProgress[task.id]}%`);
             console.log(`  Subtasks for task '${task.title}':`, task.subtasks?.map(s => s.status));
           });
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

    const numTasks = this.mainTasks.length;
    const portionPerTask = 100 / numTasks;
    let accumulatedProgress = 0;

    this.mainTasks.forEach(task => {
      const taskProgress = this.taskProgress[task.id] || 0;
      accumulatedProgress += (taskProgress / 100) * portionPerTask;
    });

    this.totalProgress = Math.round(accumulatedProgress);
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

  getCompletedSubtasksCount(task: MainTask): number {
    return task.subtasks?.filter(subtask => subtask.status === 'completed').length || 0;
  }

  getTotalSubtasksCount(task: MainTask): number {
    return task.subtasks?.length || 0;
  }

  getProgressBarGradient(): string {
    if (!this.mainTasks || this.mainTasks.length === 0) {
      return 'linear-gradient(to right, #e5e5e5, #e5e5e5)'; // Gray if no tasks
    }

    const orange = '#ff8500';
    const orangeDark = '#ff6b00'; // For 100% completion
    const gray = '#e5e5e5';

    const numTasks = this.mainTasks.length;

    // Special case: If there's only one main task, the bar simply shows its progress
    if (numTasks === 1) {
      const taskProgress = this.taskProgress[this.mainTasks[0].id] || 0;
      const fillColor = taskProgress === 100 ? orangeDark : orange;
      console.log(`Single task progress bar for Task ID ${this.mainTasks[0].id}: ${taskProgress}%`);
      return `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${taskProgress}%, ${gray} ${taskProgress}%, ${gray} 100%)`;
    }

    // For multiple tasks, we divide the bar into (numTasks - 1) segments
    // Each segment represents the progress of the *preceding* task.
    const visualSegmentSpan = 100 / (numTasks - 1);

    let gradientParts: string[] = [];
    let currentGlobalPosition = 0; // Tracks the current position along the 100% total bar

    // Loop through all main tasks *except the last one*, as the last one is just an endpoint
    for (let i = 0; i < numTasks - 1; i++) {
      const task = this.mainTasks[i];
      const taskProgress = this.taskProgress[task.id] || 0; // 0-100% completion for THIS task's subtasks

      let filledColor = gray; // Default color for not started
      if (taskProgress === 100) {
        filledColor = orangeDark; // Completed
      } else if (taskProgress > 0) {
        filledColor = orange; // In progress
      }

      // Calculate how much of this specific visual segment is filled
      const filledPortionInSegment = (taskProgress / 100) * visualSegmentSpan;

      const segmentStart = currentGlobalPosition.toFixed(4);
      const segmentFillEnd = (currentGlobalPosition + filledPortionInSegment).toFixed(4);
      const segmentEnd = (currentGlobalPosition + visualSegmentSpan).toFixed(4);

      // Add the filled portion for this segment
      if (filledPortionInSegment > 0) {
        gradientParts.push(`${filledColor} ${segmentStart}%`, `${filledColor} ${segmentFillEnd}%`);
      }

      // Add the unfilled portion for this segment
      if (filledPortionInSegment < visualSegmentSpan) {
        gradientParts.push(`${gray} ${segmentFillEnd}%`, `${gray} ${segmentEnd}%`);
      }

      currentGlobalPosition += visualSegmentSpan; // Move to the start of the next segment
    }

    // In case the last segment doesn't perfectly reach 100% due to floating points
    if (currentGlobalPosition < 100) {
      gradientParts.push(`${gray} ${currentGlobalPosition.toFixed(4)}%`, `${gray} 100%`);
    }

    console.log('Final getProgressBarGradient parts (segmented by gaps):', gradientParts.join(', '));

    return `linear-gradient(to right, ${gradientParts.join(', ')})`;
  }

  // Helper function for progress point and label positioning
  calculateLeft(index: number, totalTasks: number): string {
    if (totalTasks <= 1) return '0%'; // For one task, point is at 0
    const offset = 100 / (totalTasks - 1);
    return `${index * offset}%`;
  }

  getTaskSegmentStyle(task: MainTask): any {
    const progress = this.taskProgress[task.id] || 0;
    const color = progress === 100 ? '#ff6b00' : progress > 0 ? '#ff8500' : '#e5e5e5';
    
    return {
      'width': `${progress}%`,
      'background-color': color,
      'height': '100%',
      'transition': 'width 0.3s ease-in-out'
    };
  }

  getTaskSegmentWidth(): string {
    return `${100 / this.mainTasks.length}%`;
  }
}
