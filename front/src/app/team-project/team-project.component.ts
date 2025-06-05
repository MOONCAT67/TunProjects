import { Component, OnInit } from '@angular/core';
import { TeamService } from '../services/team.service';
import { WorkerService } from '../services/worker.service';
import { Project } from '../models/project.model';
import { User } from '../models/user';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-team-project',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-project.component.html',
  styleUrl: './team-project.component.css'
})
export class TeamProjectComponent implements OnInit {
  projects: any[] = [];
  loading = true;
  error: string | null = null;
  teamId!: number;
  workerProfiles: { [workerName: string]: any } = {};

  constructor(
    private teamService: TeamService,
    private workerService: WorkerService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.teamId = +(params.get('teamId') || 0);
      this.fetchProjects();
    });
  }

  fetchProjects() {
    this.loading = true;
    this.teamService.getTeamProjects(this.teamId).subscribe({
      next: (res) => {
        this.projects = res.data || [];
        this.fetchAllWorkerProfiles();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load projects.';
        this.loading = false;
      }
    });
  }

  fetchAllWorkerProfiles() {
    const workerIds = new Set<number>();
    this.projects.forEach(project => {
      project.main_tasks?.forEach((mainTask: any) => {
        mainTask.sub_tasks?.forEach((subTask: any) => {
          if (subTask.assigned_to) {
            workerIds.add(subTask.assigned_to);
          }
        });
      });
    });
    const profileRequests = Array.from(workerIds).map(id =>
      this.workerService.getWorkerProfile(id.toString())
    );
    forkJoin(profileRequests).subscribe({
      next: (profiles: any[]) => {
        profiles.forEach((profile, idx) => {
          this.workerProfiles[Array.from(workerIds)[idx].toString()] = profile.data;
        });
      },
      error: () => {
        // Ignore errors for individual profiles
      }
    });
  }

  getWorkerProfile(id: number) {
    return this.workerProfiles[id.toString()];
  }
}
