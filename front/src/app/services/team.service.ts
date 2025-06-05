import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Project, TeamTask } from '../models/team-task.model';

export interface TeamMember {
  id: number;
  fullname: string;
  email: string;
  profile_picture: string | null;
  role: string;
  joined_at: string;
  is_leader: boolean;
  jobs?: WorkerJob[];
}

export interface Team {
  id: number;
  name: string;
  description: string;
  created_at?: string;
  leader?: TeamMember; // Leader details might be nested
  member_count?: number; // Member count
}

export interface TeamResponse {
  message: string;
  data?: {
    team: Team;
    members: TeamMember[];
  };
}

export interface WorkerJob {
  id: number;
  years_experience: number;
  verification_date: string;
  category: {
    id: number;
    name: string;
    description: string;
    icon: string;
  };
}

export interface WorkerJobsResponse {
  statusCode: number;
  message: string;
  data: WorkerJob[];
}

export interface CreateTeamPayload {
  userId: number;
  name: string;
  description: string;
}

export interface CreateTeamResponse {
  statusCode: number;
  message: string;
  data: Team; // Or whatever the API returns upon successful creation
}

export interface SendTeamRequestPayload {
  senderId: number;
  userEmail: string;
  teamId: number; // Assuming teamId is needed to send request to a specific team
}

export interface SendTeamRequestResponse {
  statusCode: number;
  message: string;
  // Data might include confirmation or details of the sent request
}

export interface GetTeamsResponse {
  statusCode: number;
  message: string;
  data: Team[]; // Array of teams
}

export interface TeamLeaderInfo {
  email: string;
  fullname: string;
}

export interface TeamRequest {
  request_id: number;
  is_rejected: number;
  type: 'to_leader_to_join_his_team' | 'to_worker_to_join_his_team' | 'general';
  message: string;
  sender: {
    id: number;
    fullname: string;
    email: string;
    profile_picture: string | null;
    team: null | {
      id: number;
      name: string;
      role: string;
    };
  };
  recipient_team: null | {
    id: number;
    name: string;
    role?: string;
  };
}

export interface GetTeamRequestsResponse {
  message: string;
  data: TeamRequest[];
}

export interface AcceptRejectTeamRequestPayload {
  userId: number;
}

export interface AcceptRejectTeamRequestResponse {
  statusCode: number;
  message: string;
  // Data might include details of the accepted/rejected request
}

export interface TeamTaskResponse {
  data: Project[];
}

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getUserTeams(userId: number): Observable<TeamResponse> {
    return this.http.get<TeamResponse>(`${this.apiUrl}/team/teams/members/${userId}`);
  }

  getWorkerJobs(workerId: number): Observable<WorkerJobsResponse> {
    return this.http.get<WorkerJobsResponse>(`${this.apiUrl}/team/teams/worker/${workerId}/jobs`).pipe(
      catchError(error => {
        console.error(`Error fetching jobs for worker ${workerId}:`, error);
        return of({ statusCode: error.status || 500, message: error.error?.message || 'Failed to fetch jobs', data: [] });
      })
    );
  }

  createTeam(payload: CreateTeamPayload): Observable<CreateTeamResponse> {
    return this.http.post<CreateTeamResponse>(`${this.apiUrl}/team/teams`, payload).pipe(
      catchError(error => {
        console.error('Error creating team:', error);
        return throwError(() => error);
      })
    );
  }

  sendTeamRequest(payload: SendTeamRequestPayload): Observable<SendTeamRequestResponse> {
    return this.http.post<SendTeamRequestResponse>(`${this.apiUrl}/team/teams/requests`, payload).pipe(
       catchError(error => {
        console.error('Error sending team request:', error);
        return throwError(() => error);
      })
    );
  }

  getTeams(): Observable<GetTeamsResponse> {
    return this.http.get<GetTeamsResponse>(`${this.apiUrl}/team/teams`).pipe(
      catchError(error => {
        console.error('Error fetching teams:', error);
        return throwError(() => error);
      })
    );
  }

  getTeamLeaderEmail(teamId: number): Observable<{ data: TeamLeaderInfo }> {
    return this.http.get<{ data: TeamLeaderInfo }>(`${this.apiUrl}/team/teams/${teamId}/leader-email`);
  }

  getTeamRequests(userId: number): Observable<GetTeamRequestsResponse> {
    return this.http.get<GetTeamRequestsResponse>(`${this.apiUrl}/team/teams/requests/${userId}`).pipe(
      catchError(error => {
        console.error('Error fetching team requests:', error);
        return throwError(() => error);
      })
    );
  }

  acceptTeamRequest(requestId: number, payload: AcceptRejectTeamRequestPayload): Observable<AcceptRejectTeamRequestResponse> {
    return this.http.put<AcceptRejectTeamRequestResponse>(`${this.apiUrl}/teams/requests/${requestId}/accept`, payload).pipe(
      catchError(error => {
        console.error(`Error accepting team request ${requestId}:`, error);
        return throwError(() => error);
      })
    );
  }

  rejectTeamRequest(requestId: number, payload: AcceptRejectTeamRequestPayload): Observable<AcceptRejectTeamRequestResponse> {
    return this.http.put<AcceptRejectTeamRequestResponse>(`${this.apiUrl}/teams/requests/${requestId}/reject`, payload).pipe(
      catchError(error => {
        console.error(`Error rejecting team request ${requestId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // New method to check if a worker is a team leader
  checkIfWorkerIsLeader(workerId: number): Observable<{ success: boolean; message: string; isLeader: boolean; teams?: any[] }> {
    return this.http.get<{ success: boolean; message: string; isLeader: boolean; teams?: any[] }>(`${this.apiUrl}/team/leader/${workerId}`).pipe(
      catchError(error => {
        console.error(`Error checking if worker ${workerId} is a leader:`, error);
        return throwError(() => error);
      })
    );
  }

  getUserTeamTasks(userId: number): Observable<TeamTaskResponse> {
    return this.http.get<TeamTaskResponse>(`${this.apiUrl}/team/teams/user/${userId}/subtasks`);
  }

  getTeamProjects(teamId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/team/${teamId}/projects`).pipe(
      catchError(error => {
        console.error('Error fetching team projects:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetch all subtasks assigned to a user for a team
   */
  getUserTeamSubtasks(teamId: number, userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/team/teams/${teamId}/user/${userId}/subtasks`).pipe(
      catchError(error => {
        console.error('Error fetching user team subtasks:', error);
        return throwError(() => error);
      })
    );
  }
} 