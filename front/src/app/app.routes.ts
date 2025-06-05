// src/app/routes.ts
import { Routes } from '@angular/router';
import { BodyComponent } from './body/body.component';
import { PlumberComponent } from './plumber/plumber.component';
import { PainterComponent } from './painter/painter.component';
import { BuildingComponent } from './building/building.component';
import { ElectricianComponent } from './electrician/electrician.component';
import { CarpenterComponent } from './carpenter/carpenter.component';
import { TilierComponent } from './tilier/tilier.component';
import { AuthComponent } from './auth/auth.component';
import { PostprojectComponent } from './postproject/postproject.component';
import { ClientProjectsComponent } from './client-projects/client-projects.component';
import { ClientProjectApplicationsComponent } from './client-project-applications/client-project-applications.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { BecomePartenerComponent } from './become-partener/become-partener.component';
import { WorkerPageComponent } from './worker-page/worker-page.component';
import { ProjectDetailsComponent } from './project-details/project-details.component';
import { ProfileComponent } from './profile/profile.component';
import { ProjectProgressComponent } from './project-progress/project-progress.component';
import { WorkerCurrentProjectsComponent } from './worker-current-projects/worker-current-projects.component';
import { CreatingTasksComponent } from './creating-tasks/creating-tasks.component';
import { MessagirieComponent } from './messagirie/messagirie.component';
import { TeamPageComponent } from './team-page/team-page.component';
import { GetTeamComponent } from './get-team/get-team.component';
import { SearchWorkerComponent } from './search-worker/search-worker.component';
import { TeamProjectComponent } from './team-project/team-project.component';
import { TeamtaskComponent } from './teamtask/teamtask.component';
import { ContractComponent } from './contract/contract.component';
import { WorkerContractSignComponent } from './worker-contract-sign/worker-contract-sign.component';
import { AddtaskComponent } from './addtask/addtask.component';

export const routes: Routes = [
  { path: 'body', component: BodyComponent },
  { path: 'plumber', component: PlumberComponent },
  { path: 'painter', component: PainterComponent },
  { path: 'building', component: BuildingComponent},
  { path: 'carpenter', component: CarpenterComponent},
  { path: 'electrician', component: ElectricianComponent},
  { path: 'tilier', component:TilierComponent},
  { path: 'auth', component:AuthComponent},
  { path: 'postproject' ,component:PostprojectComponent},
  { 
    path: 'client/projects', 
    component: ClientProjectsComponent 
  },
  { 
    path: 'client/projects/:projectId/applications', 
    component: ClientProjectApplicationsComponent 
  },
  {
    path: 'admin/dashboard',
    component: AdminDashboardComponent
  },
  {
    path: 'become-partner',
    component: BecomePartenerComponent
  },
  {
    path: 'worker',
    component: WorkerPageComponent
  },
  {
    path: 'worker/current-projects',
    component: WorkerCurrentProjectsComponent
  },
  {
    path: 'worker/create-tasks/:projectId',
    component: CreatingTasksComponent
  },
  {
    path: 'addtask/:projectId',
    component: AddtaskComponent
  },
  {
    path: 'projects/:id',
    component: ProjectDetailsComponent
  },
  {
    path: 'profile/:workerId',
    component: ProfileComponent
  },
  {
    path: 'project-progress/:id',
    component: ProjectProgressComponent
  },
  {
    path: 'messagerie',
    component: MessagirieComponent
  },
  {
    path: 'team',
    component: TeamPageComponent
  },
  {
    path: 'get-team',
    component: GetTeamComponent
  },
  {
    path: 'search-worker',
    component: SearchWorkerComponent
  },
  {
    path: 'team-projects/:teamId',
    component: TeamProjectComponent
  },
  {
    path: 'team-tasks/:teamId/:userId',
    component: TeamtaskComponent
  },
  {
    path: 'contract/:projectId',
    component: ContractComponent
  },
  {
    path: 'contract/sign/:contractId',
    component: WorkerContractSignComponent
  },
  { path: '', redirectTo: '/body', pathMatch: 'full' } // Default route to 'body'
];
