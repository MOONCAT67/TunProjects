import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { WorkerService } from '../services/worker.service';
import { AuthService } from '../services/authService';
import { JobCategory, VerificationRequest } from '../models/verification.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-become-partener',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './become-partener.component.html',
  styleUrls: ['./become-partener.component.css']
})
export class BecomePartenerComponent implements OnInit {
  verificationForm: FormGroup;
  jobCategories: JobCategory[] = [];
  loading = false;
  error: string | null = null;
  success = false;
  currentYear = new Date().getFullYear();
  showCustomAlert = false;

  constructor(
    private fb: FormBuilder,
    private workerService: WorkerService,
    private authService: AuthService,
    private router: Router
  ) {
    this.verificationForm = this.fb.group({
      requestDescription: ['', [Validators.required, Validators.minLength(10)]],
      jobs: this.fb.array([this.createJobFormGroup()]),
      certificates: this.fb.array([this.createCertificateFormGroup()]),
      pastProjects: this.fb.array([this.createPastProjectFormGroup()])
    });
  }

  ngOnInit() {
    this.loadJobCategories();
  }

  get jobs() {
    return this.verificationForm.get('jobs') as FormArray;
  }

  get certificates() {
    return this.verificationForm.get('certificates') as FormArray;
  }

  get pastProjects() {
    return this.verificationForm.get('pastProjects') as FormArray;
  }

  createJobFormGroup(): FormGroup {
    return this.fb.group({
      jobCategoryId: ['', Validators.required],
      experienceYears: ['', [Validators.required, Validators.min(0), Validators.max(50)]]
    });
  }

  createCertificateFormGroup(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      issuer: ['', Validators.required],
      year: ['', [Validators.required, Validators.min(1900), Validators.max(this.currentYear)]]
    });
  }

  createPastProjectFormGroup(): FormGroup {
    return this.fb.group({
      title: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      year: ['', [Validators.required, Validators.min(1900), Validators.max(this.currentYear)]]
    });
  }

  addJob() {
    this.jobs.push(this.createJobFormGroup());
  }

  removeJob(index: number) {
    this.jobs.removeAt(index);
  }

  addCertificate() {
    this.certificates.push(this.createCertificateFormGroup());
  }

  removeCertificate(index: number) {
    this.certificates.removeAt(index);
  }

  addPastProject() {
    this.pastProjects.push(this.createPastProjectFormGroup());
  }

  removePastProject(index: number) {
    this.pastProjects.removeAt(index);
  }

  loadJobCategories() {
    this.workerService.getJobs().subscribe({
      next: (response) => {
        this.jobCategories = response;
        console.log('Loaded Job Categories:', this.jobCategories);
      },
      error: () => {
        this.error = 'Failed to load job categories. Please try again later.';
      }
    });
  }

  onSubmit() {
    if (this.verificationForm.valid) {
      this.loading = true;
      this.error = null;
      this.success = false;

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        this.error = 'You must be logged in to submit a verification request';
        this.loading = false;
        return;
      }

      const request: VerificationRequest = {
        userId: currentUser.id,
        requestDescription: this.verificationForm.value.requestDescription,
        jobs: this.jobs.value,
        certificates: this.certificates.value,
        pastProjects: this.pastProjects.value
      };
      console.log('VerificationRequest payload:', request);
      this.workerService.submitVerificationRequest(request).subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
          this.verificationForm.reset();
          while (this.jobs.length) this.jobs.removeAt(0);
          while (this.certificates.length) this.certificates.removeAt(0);
          while (this.pastProjects.length) this.pastProjects.removeAt(0);
          this.jobs.push(this.createJobFormGroup());
          this.certificates.push(this.createCertificateFormGroup());
          this.pastProjects.push(this.createPastProjectFormGroup());
          this.showCustomAlert = true;
        },
        error: (error) => {
          this.loading = false;
          this.error = error.error?.message || 'Failed to submit verification request. Please try again.';
        }
      });
    } else {
      this.markFormGroupTouched(this.verificationForm);
    }
  }

  onAlertConfirm() {
    this.showCustomAlert = false;
    this.router.navigate(['/body']);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
