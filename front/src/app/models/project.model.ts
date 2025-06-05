import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export interface RequiredJob {
  id: number;
  project_id: number;
  job_category_id: number;
  workers_needed: number;
  job_name: string;
  job_description: string;
  job_icon: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  budget: string;
  employer_id: number;
  status: string;
  deadline: string;
  address: string;
  current_progress: number;
  project_type: string;
  cancellation_reason: string | null;
  completion_date: string | null;
  created_at: string;
  client_id: number;
  main_tasks_number: number;
  current_phase: number;
  deposit_paid: number;
  final_payment_paid: number;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  total_applications?: number;
  application_count?: number;
  total_tasks?: number;
  required_jobs?: RequiredJob[];
  attachments?: any[];
  main_tasks?: any[];
}

export interface ProjectApplication {
  workerId: number;
  laborPrice: number;
  materialsPrice: number;
  estimatedDuration: string;
  workType: 'solo' | 'team';
} 