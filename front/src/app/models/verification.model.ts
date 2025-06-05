export interface Job {
  jobCategoryId: number;
  experienceYears: number;
}

export interface Certificate {
  name: string;
  issuer: string;
  year: number;
}

export interface PastProject {
  title: string;
  description: string;
  year: number;
}

export interface VerificationRequest {
  userId: number;
  requestDescription: string;
  jobs: Job[];
  certificates: Certificate[];
  pastProjects: PastProject[];
}

export interface JobCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
} 