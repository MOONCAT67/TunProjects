import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { WorkerService, SoloProject, Task, CompletedProject } from '../services/worker.service';
import { AuthService } from '../services/authService';
import { ProjectTasksService, SubtaskCreationInput } from '../services/project-tasks.service';
import { ContractService } from '../services/contract.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

interface GetContractIdResponse {
  data: {
    contractId: number;
  };
}

interface Project {
  id: number;
  client_id: number;
  // ... other project properties
}

@Component({
  selector: 'app-worker-current-projects',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './worker-current-projects.component.html',
  styleUrl: './worker-current-projects.component.css',
  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({
        maxHeight: '0',
        opacity: '0',
        overflow: 'hidden'
      })),
      state('expanded', style({
        maxHeight: '1000px',
        opacity: '1'
      })),
      transition('collapsed <=> expanded', [
        animate('300ms ease-in-out')
      ])
    ])
  ]
})
export class WorkerCurrentProjectsComponent implements OnInit {
  projects: SoloProject[] = [];
  unsignedProjects: { [key: string]: boolean } = {};
  isLoading: boolean = true;
  error: string | null = null;
  expandedTasks: { [key: string]: boolean } = {};
  subtaskForm: FormGroup;
  showSubtaskForm = false;
  currentTaskId: string | null = null;
  isSubmittingSubtask = false;
  completedProjects: CompletedProject[] = [];
  loadingCompletedProjects: boolean = false;
  completedProjectsError: string | null = null;

  constructor(
    private workerService: WorkerService,
    private authService: AuthService,
    private projectTasksService: ProjectTasksService,
    private contractService: ContractService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.subtaskForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      deadline: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadCurrentProjects();
    this.loadCompletedProjects();
  }

  loadCurrentProjects() {
    this.isLoading = true;
    this.error = null;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.error = 'User not authenticated';
      this.isLoading = false;
      return;
    }

    this.workerService.getInProgressSoloProjects(currentUser.id).subscribe({
      next: (response) => {
        if (response.statusCode === 200) {
          this.projects = response.data;
          // Initialize expanded state for all tasks and check contract signatures
          this.projects.forEach(project => {
            project.tasks.forEach(task => {
              this.expandedTasks[task.id] = false;
            });
            // Check contract signature for each project
            this.checkContractSignature(project.id.toString());
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading current projects:', error);
        this.error = 'Failed to load current projects. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  loadCompletedProjects() {
    this.loadingCompletedProjects = true;
    this.completedProjectsError = null;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.completedProjectsError = 'User not authenticated';
      this.loadingCompletedProjects = false;
      return;
    }

    this.workerService.getCompletedProjects(currentUser.id).subscribe({
      next: (response) => {
        if (response.statusCode === 200) {
          // Filter only solo projects
          this.completedProjects = response.data.filter(project => project.project_type === 'solo');
        }
        this.loadingCompletedProjects = false;
      },
      error: (error) => {
        console.error('Error loading completed projects:', error);
        this.completedProjectsError = 'Failed to load completed projects';
        this.loadingCompletedProjects = false;
      }
    });
  }

  checkContractSignature(projectId: string) {
    this.contractService.checkWorkerSignatureByProject(Number(projectId)).subscribe({
      next: (response) => {
        this.unsignedProjects[projectId] = response.isSigned === 0;
      },
      error: (error) => {
        console.error('Error checking contract signature:', error);
        this.unsignedProjects[projectId] = true; // Assume unsigned on error
      }
    });
  }

  goToSignContract(projectId: string) {
    this.contractService.getContractIdByProjectId(Number(projectId)).subscribe({
      next: (response) => {
        if (response.statusCode === 200 && response.contractId) {
          this.router.navigate(['/contract/sign', response.contractId]);
        } else {
          console.error('Contract ID not found for project:', projectId);
          // Optionally, handle error, e.g., show a message to the user
        }
      },
      error: (err) => {
        console.error('Error fetching contract ID:', err);
        // Optionally, handle error, e.g., show a message to the user
      }
    });
  }

  toggleTask(taskId: string) {
    this.expandedTasks[taskId] = !this.expandedTasks[taskId];
  }

  getStatusColor(status: string | null | undefined): string {
    if (!status) return '#9E9E9E'; // Default gray color for null/undefined status

    switch (status.toLowerCase()) {
      case 'completed':
        return '#4CAF50';
      case 'in progress':
        return '#2196F3';
      case 'not started':
        return '#FFC107';
      default:
        return '#9E9E9E';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTaskProgress(project: any): { completed: number; inProgress: number; notStarted: number } {
    if (!project.tasks || !Array.isArray(project.tasks)) {
      return { completed: 0, inProgress: 0, notStarted: 0 };
    }

    const completed = project.tasks.filter((task: any) => 
      task.status && task.status.toLowerCase() === 'completed'
    ).length;

    const inProgress = project.tasks.filter((task: any) => 
      task.status && task.status.toLowerCase() === 'in progress'
    ).length;

    const notStarted = project.tasks.filter((task: any) => 
      task.status && task.status.toLowerCase() === 'not started'
    ).length;

    return { completed, inProgress, notStarted };
  }

  createNewTask(projectId: string) {
    this.router.navigate(['/create-task', projectId]);
  }

  createNewSubtask(projectId: string, taskId: string) {
    this.router.navigate(['/create-subtask', projectId, taskId]);
  }

  downloadContract(projectId: string) {
    // Ensure projectId is a number for services that require it
    const idAsNumber = Number(projectId);

    // First get the project details to get the client ID
    this.workerService.getProjectDetails(projectId).subscribe({
      next: (projectDetails) => {
        // Then get the contract ID for this project
        this.contractService.getContractIdByProjectId(idAsNumber).subscribe({
          next: (response) => {
            if (response && response.contractId) {
              const contractId = response.contractId;
              // Then download the contract using the contract ID and client ID
              this.contractService.downloadContract(contractId, projectDetails.client_id).subscribe({
                next: (blob) => {
                  // Create a blob URL and trigger download
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `contract-${contractId}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                },
                error: (error) => {
                  console.error('Error downloading contract:', error);
                }
              });
            } else {
              console.error('No contract ID found for project');
            }
          },
          error: (error) => {
            console.error('Error getting contract ID:', error);
          }
        });
      },
      error: (error) => {
        console.error('Error getting project details:', error);
      }
    });
  }

  startSubtask(subtask: any): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (userId) {
      this.projectTasksService.updateSubtaskStatus(subtask.id, 'in progress', userId).subscribe({
        next: () => {
          this.updateSubtaskStatusLocally(subtask.id, 'in progress');
        },
        error: (err) => {
          console.error('Error starting subtask:', err);
          alert('Failed to start subtask.');
        }
      });
    } else {
      alert('User not authenticated.');
    }
  }

  finishSubtask(subtask: any): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (userId) {
      this.projectTasksService.updateSubtaskStatus(subtask.id, 'completed', userId).subscribe({
        next: () => {
          this.updateSubtaskStatusLocally(subtask.id, 'completed');
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

  updateSubtaskStatusLocally(subtaskId: number, status: string): void {
    for (const project of this.projects) {
      for (const task of project.tasks) {
        const subtask = task.subtasks.find(st => Number(st.id) === subtaskId);
        if (subtask) {
          subtask.status = status;
          break;
        }
      }
    }
  }

  completeMainTask(task: any): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (userId) {
      this.projectTasksService.completeMainTask(task.id, userId).subscribe({
        next: () => {
          // Update the task status locally
          task.status = 'completed';
        },
        error: (err) => {
          console.error('Error completing task:', err);
          alert('Failed to complete task.');
        }
      });
    } else {
      alert('User not authenticated.');
    }
  }

  hasNoSubtasks(task: any): boolean {
    return !task.subtasks || 
           task.subtasks.length === 0 || 
           (task.subtasks.length === 1 && 
            task.subtasks[0].id === null && 
            task.subtasks[0].title === null);
  }

  showSubtaskFormForTask(taskId: string) {
    console.log('Showing form for task:', taskId); // Debug log
    this.currentTaskId = taskId;
    this.showSubtaskForm = true;
    this.subtaskForm.reset();
  }

  cancelSubtaskForm() {
    console.log('Canceling form'); // Debug log
    this.showSubtaskForm = false;
    this.currentTaskId = null;
    this.subtaskForm.reset();
  }

  onSubmitSubtask() {
    console.log('Submitting subtask form'); // Debug log
    if (this.subtaskForm.valid && this.currentTaskId) {
      this.isSubmittingSubtask = true;
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      const subtaskData: SubtaskCreationInput = {
        title: this.subtaskForm.value.title,
        description: this.subtaskForm.value.description,
        deadline: this.subtaskForm.value.deadline
      };

      console.log('Subtask data:', subtaskData); // Debug log

      this.projectTasksService.createSubtask(Number(this.currentTaskId), currentUser.id, subtaskData)
        .subscribe({
          next: (response) => {
            console.log('Subtask created successfully:', response); // Debug log
            this.isSubmittingSubtask = false;
            this.showSubtaskForm = false;
            this.currentTaskId = null;
            this.subtaskForm.reset();
            this.loadCurrentProjects(); // Reload the projects to show the new subtask
          },
          error: (error) => {
            console.error('Error creating subtask:', error); // Debug log
            this.isSubmittingSubtask = false;
            this.error = error.message || 'Failed to create subtask';
          }
        });
    } else {
      console.log('Form is invalid or no task ID'); // Debug log
    }
  }

  viewProjectDetails(projectId: string | number) {
    const id = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    this.router.navigate(['/project-details', id]);
  }

  contactClient(clientId: number, clientName: string, clientPicture: string | null) {
    // Navigate to messaging component with the client ID, name, and picture as query parameters
    this.router.navigate(['/messagerie'], { 
      queryParams: { 
        clientId: clientId,
        clientName: clientName,
        clientPicture: clientPicture || null,
        startConversation: true 
      }
    });
  }
}
