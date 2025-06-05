import { Component, OnInit } from '@angular/core';
import { TeamService, TeamResponse, WorkerJob, TeamMember } from '../services/team.service';
import { AuthService } from '../services/authService';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, tap, switchMap, map } from 'rxjs/operators';

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule],
  templateUrl: './team-page.component.html',
  styleUrl: './team-page.component.css'
})
export class TeamPageComponent implements OnInit {
  teamData: TeamResponse | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private teamService: TeamService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadTeamData();
  }

  loadTeamData() {
    const user = this.authService.getCurrentUser();
    console.log('Current user:', user);
    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }

    this.teamService.getUserTeams(user.id).pipe(
      tap((response: TeamResponse) => {
        console.log('Team data response:', response);
        this.teamData = response;
      }),
      switchMap((response: TeamResponse) => {
        if (response.data && response.data.members && response.data.members.length > 0) {
          console.log('Fetching jobs for members:', response.data.members);
          const memberJobRequests: Observable<{ memberId: number, jobs: WorkerJob[] }>[] = response.data.members.map(member =>
            this.teamService.getWorkerJobs(member.id).pipe(
              tap(jobsResponse => {
                console.log(`Raw jobs response for member ${member.id}:`, jobsResponse);
              }),
              map(jobsResponse => {
                console.log(`Jobs for member ${member.id}:`, jobsResponse.data);
                return { memberId: member.id, jobs: jobsResponse.data };
              }),
              catchError(error => {
                console.error(`Failed to fetch jobs for worker ${member.id}:`, error);
                return of({ memberId: member.id, jobs: [] });
              })
            )
          );
          return forkJoin(memberJobRequests);
        } else {
          console.log('No members found in team data');
          return of([]);
        }
      })
    ).subscribe({
      next: (memberJobs: { memberId: number, jobs: WorkerJob[] }[]) => {
        console.log('All member jobs loaded:', memberJobs);
        if (this.teamData?.data?.members) {
          this.teamData.data.members = this.teamData.data.members.map(member => {
            const foundMemberJobs = memberJobs.find(mj => mj.memberId === member.id);
            return { ...member, jobs: foundMemberJobs ? foundMemberJobs.jobs : [] };
          });
          console.log('Final teamData with jobs:', this.teamData);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading team data:', error);
        this.error = error.error?.message || 'Failed to load team data';
        this.loading = false;
      }
    });
  }

  getLeader(): TeamMember | undefined {
    return this.teamData?.data?.members.find(member => member.is_leader === true);
  }

  getMembers(): TeamMember[] | undefined {
    return this.teamData?.data?.members.filter(member => member.is_leader === false);
  }

  getJobColorClass(index: number): string {
    const colors = ['job-color-orange', 'job-color-blue', 'job-color-black', 'job-color-grey'];
    return colors[index % colors.length];
  }

  getCurrentUserId(): number | null {
    return this.authService.getCurrentUser()?.id || null;
  }
}
