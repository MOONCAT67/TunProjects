import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectTasksService, TaskWithSubtasksInput } from '../services/project-tasks.service';

@Component({
  selector: 'app-addtask',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './addtask.component.html',
  styleUrl: './addtask.component.css'
})
export class AddtaskComponent implements OnInit {
  taskForm: FormGroup;
  projectId!: number;
  userId!: number;
  maxSubtasks = 30;
  isSubmitting = false;
  error: string | null = null;
  hasSubtasks = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private projectTasksService: ProjectTasksService
  ) {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      subtasks: this.fb.array([])
    });
  }

  ngOnInit() {
    // Get projectId from route parameters
    this.route.params.subscribe(params => {
      this.projectId = +params['projectId']; // Convert to number using +
      
      // Get user from localStorage
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) {
        this.error = 'User not authenticated';
        return;
      }

      const user = JSON.parse(currentUser);
      if (!user || !user.id) {
        this.error = 'Invalid user data';
        return;
      }

      this.userId = user.id;
    });
  }

  get subtasks() {
    return this.taskForm.get('subtasks') as FormArray;
  }

  createSubtaskForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      assigned_to: [this.userId] // Default to current user
    });
  }

  toggleSubtasks() {
    this.hasSubtasks = !this.hasSubtasks;
    if (this.hasSubtasks && this.subtasks.length === 0) {
      this.addSubtask();
    } else if (!this.hasSubtasks) {
      // Clear all subtasks
      while (this.subtasks.length) {
        this.subtasks.removeAt(0);
      }
    }
  }

  addSubtask() {
    if (this.subtasks.length < this.maxSubtasks) {
      this.subtasks.push(this.createSubtaskForm());
    }
  }

  removeSubtask(index: number) {
    this.subtasks.removeAt(index);
  }

  onSubmit() {
    if (this.taskForm.valid && this.userId) {
      this.isSubmitting = true;
      this.error = null;

      // Create the task data based on whether subtasks are enabled
      const taskData: TaskWithSubtasksInput = {
        title: this.taskForm.value.title,
        description: this.taskForm.value.description,
        // Only include subtasks if hasSubtasks is true and there are actual subtasks
        ...(this.hasSubtasks && this.subtasks.length > 0 ? {
          subtasks: this.taskForm.value.subtasks
        } : {})
      };

      this.projectTasksService.createTaskWithSubtasks(this.projectId, this.userId, taskData)
        .subscribe({
          next: (response) => {
            this.isSubmitting = false;
            this.router.navigate(['/worker/current-projects']);
          },
          error: (error) => {
            this.isSubmitting = false;
            this.error = error.message || 'An error occurred while creating the task';
          }
        });
    }
  }
}
