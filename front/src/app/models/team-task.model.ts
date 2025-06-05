export interface SubTask {
  id: number;
  title: string;
  description: string;
  status: string;
  deadline: string;
  assigned_to: number;
  created_at: string;
}

export interface MainTask {
  main_task_id: number;
  main_task_title: string;
  main_task_description: string;
  main_task_status: string;
  main_task_deadline: string;
  sub_tasks: SubTask[];
}

export interface Project {
  project_id: number;
  project_title: string;
  current_phase: number;
  main_tasks_number: number;
  project_status: string;
  main_tasks: MainTask[];
}

export interface TeamTaskResponse {
  data: Project[];
}

export interface TeamTask {
  id: number;
  main_task_id: number;
  title: string;
  description: string;
  assigned_to: number;
  assigned_type: string;
  status: string;
  deadline: string;
  created_at: string;
  completed_at: string | null;
  progress_percentage: number;
  main_task_title: string;
  main_task_description: string;
  main_task_status: string;
  main_task_deadline: string;
  project_id: number;
  project_title: string;
  current_phase: number;
  main_tasks_number: number;
  project_status: string;
} 