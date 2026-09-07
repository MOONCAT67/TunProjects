import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export interface SubTask {
  id: number;
  title: string;
  description: string;
  status: 'not started' | 'in progress' | 'completed' | '';
  progress_percentage: number;
  deadline: string;
  assigned_to: number;
  assigned_type: 'individual' | 'team';
  team_name?: string | null;
  attachments: any[];
  assigned_to_name?: string | null;
}

export interface MainTask {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: 'not started' | 'in progress' | 'completed' | '';
  progress_percentage: number;
  deadline: string;
  created_at: string;
  completed_at: string | null;
  assigned_to: number;
  assigned_type: 'individual' | 'team';
  sequence_order: number;
  assigned_to_name: string | null;
  team_name: string | null;
  attachments: any[];
  subtasks: SubTask[];
}

export interface ProjectTasksResponse {
  statusCode: number;
  message: string;
  data: MainTask[];
}

export interface Subtask {
  title: string;
  description: string;
  status: string;
  progress_percentage: number;
  deadline: string;
  assigned_to: number;
  assigned_type: string;
}

export interface Task {
  title: string;
  description: string;
  status: string;
  progress_percentage: number;
  deadline: string;
  assigned_to: number;
  assigned_type: string;
  sequence_order: number;
  subtasks: Subtask[];
}

export interface BulkTasksPayload {
  tasks: Task[];
}

export interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export interface WorkerJobProfile {
  id: number;
  years_experience: number;
  verification_date: string | null;
  category: Category;
}

export interface UserProfile {
  id: number;
  fullname: string;
  email: string;
  role: string;
  profile_picture: string | null;
  created_at: string;
  is_worker: number;
  is_verified: number;
  phone_number?: string;
}

export interface TeamProfile {
  id: number;
  name: string;
  description: string;
  role: string;
  joined_at: string;
  is_leader: number;
}

export interface Statistics {
  tasks: { total: number; completed: string; in_progress: string; not_started: string };
  projects: { total: number; completed: string; in_progress: string };
}

export interface WorkerProfileResponse {
  statusCode: number;
  message: string;
  data: {
    user: UserProfile;
    team: TeamProfile | null;
    jobs: WorkerJobProfile[];
    statistics: Statistics;
  };
}

interface TeamMember {
  id: number;
  fullname: string;
  email: string;
  profile_picture: string;
  role: string;
  joined_at: string;
  is_leader: boolean;
}

interface Team {
  id: number;
  name: string;
  description: string;
}

interface TeamMembersResponse {
  statusCode: number;
  message: string;
  data: {
    team: Team;
    members: TeamMember[];
  };
}

export interface SubtaskInput {
  title: string;
  description: string;
}

export interface TaskWithSubtasksInput {
  title: string;
  description: string;
  subtasks?: SubtaskInput[];
}

export interface SubtaskCreationInput {
  title: string;
  description: string;
  deadline: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectTasksService {
  private apiUrl = environment.apiUrl;
  private baseUrl = `${environment.apiUrl}/task`;

  constructor(private http: HttpClient) {}

  getProjectTasks(projectId: number): Observable<ProjectTasksResponse> {
    return this.http.get<ProjectTasksResponse>(`${this.apiUrl}/task/${projectId}/tasks`).pipe(
      catchError(this.handleError)
    );
  }

  getCurrentPhaseTasks(projectId: number): Observable<ProjectTasksResponse> {
    return this.http.get<ProjectTasksResponse>(`${this.apiUrl}/task/${projectId}/current-phase-tasks`).pipe(
      catchError(this.handleError)
    );
  }

  createBulkTasks(projectId: number, tasks: Task[]): Observable<any> {
    const payload: BulkTasksPayload = { tasks };
    return this.http.post(`${this.baseUrl}/${projectId}/tasks/bulk`, payload).pipe(
      catchError(this.handleError)
    );
  }

  getTeamMembers(userId: number): Observable<TeamMembersResponse> {
    return this.http.get<TeamMembersResponse>(`${this.baseUrl}/team-members/${userId}`);
  }

  getWorkerProfile(workerId: number): Observable<WorkerProfileResponse> {
    return this.http.get<WorkerProfileResponse>(`${this.apiUrl}/task/profile/${workerId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Update the status of a subtask.
   * @param subtaskId The ID of the subtask.
   * @param status The new status ('in progress' or 'completed').
   * @param workerId The ID of the worker updating the status.
   */
  updateSubtaskStatus(subtaskId: number, status: 'in progress' | 'completed', workerId: number): Observable<any> {
    const payload = { status, workerId };
    return this.http.put<any>(`${this.apiUrl}/task/subtasks/${subtaskId}/status`, payload).pipe(
      catchError(error => {
        console.error(`Error updating status for subtask ${subtaskId}:`, error);
        return throwError(() => error);
      })
    );
  }

  completeMainTask(mainTaskId: number, workerId: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/main-tasks/${mainTaskId}/complete/${workerId}`, {}).pipe(
      catchError(error => {
        console.error(`Error completing main task ${mainTaskId}:`, error);
        return throwError(() => error);
      })
    );
  }

  createTaskWithSubtasks(projectId: number, userId: number, taskData: TaskWithSubtasksInput): Observable<any> {
    return this.http.post(`${this.baseUrl}/${projectId}/tasks-with-subtasks/${userId}`, taskData).pipe(
      catchError(this.handleError)
    );
  }

  createSubtask(mainTaskId: number, workerId: number, subtaskData: SubtaskCreationInput): Observable<any> {
    return this.http.post(`${this.baseUrl}/main-tasks/${mainTaskId}/subtasks/${workerId}`, subtaskData).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('An error occurred', error);
    return throwError(() => new Error(error.message || 'Server Error'));
  }
} 