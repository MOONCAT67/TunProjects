import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PaymentService, PaymentPayload, PaymentResponse, PaymentAmountResponse } from '../services/payment.service';
import { AuthService } from '../services/authService'; // Assuming you need client ID

@Component({
  selector: 'app-payement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payement.component.html',
  styleUrl: './payement.component.css'
})
export class PayementComponent implements OnInit, OnDestroy {
  projectId: number | null = null;
  clientId: number | null = null;
  amount: number = 0;
  paymentType: string = '';
  totalPrice: string = '';
  materialsPrice: string = '';
  laborPrice: string = '';

  cardNumber: string = '';
  expiryMonth: string = '';
  expiryYear: string = '';
  cvc: string = '';
  cardholderName: string = '';

  paymentStatus: 'success' | 'error' | null = null;
  paymentMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private paymentService: PaymentService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.projectId = Number(params.get('projectId'));
      this.clientId = Number(params.get('clientId'));
      
      if (this.projectId) {
        this.fetchPaymentAmount(this.projectId);
      }
    });
  }

  fetchPaymentAmount(projectId: number): void {
    this.isLoading = true;
    this.paymentService.getPaymentAmount(projectId).subscribe({
      next: (response: PaymentAmountResponse) => {
        if (response.success) {
          this.amount = parseFloat(response.amount);
          this.paymentType = response.paymentType;
          this.totalPrice = response.totalPrice;
          this.materialsPrice = response.materialsPrice;
          this.laborPrice = response.laborPrice;
        } else {
          this.paymentStatus = 'error';
          this.paymentMessage = 'Failed to fetch payment amount.';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.paymentStatus = 'error';
        this.paymentMessage = error.message || 'Failed to fetch payment amount.';
        this.isLoading = false;
      }
    });
  }

  processPayment(): void {
    if (!this.projectId || !this.clientId || !this.amount || !this.cardNumber || !this.expiryMonth || !this.expiryYear || !this.cvc || !this.cardholderName) {
      this.paymentStatus = 'error';
      this.paymentMessage = 'Please fill in all payment details.';
      return;
    }

    this.isLoading = true;
    this.paymentStatus = null;
    this.paymentMessage = '';

    const parsedExpiryMonth = parseInt(this.expiryMonth, 10);
    const parsedExpiryYear = parseInt(this.expiryYear, 10);
    const parsedCvc = parseInt(this.cvc, 10);

    if (isNaN(parsedExpiryMonth) || parsedExpiryMonth < 1 || parsedExpiryMonth > 12) {
      this.paymentStatus = 'error';
      this.paymentMessage = 'Invalid expiry month. Must be between 01 and 12.';
      return;
    }

    const currentYear = new Date().getFullYear();
    if (isNaN(parsedExpiryYear) || this.expiryYear.length !== 4 || parsedExpiryYear < currentYear) {
      this.paymentStatus = 'error';
      this.paymentMessage = 'Invalid expiry year. Must be a 4-digit future year.';
      return;
    }

    if (isNaN(parsedCvc) || (this.cvc.length !== 3 && this.cvc.length !== 4)) {
      this.paymentStatus = 'error';
      this.paymentMessage = 'Invalid CVC. Must be 3 or 4 digits.';
      return;
    }

    const payload = {
      projectId: this.projectId,
      clientId: this.clientId,
      amount: this.amount,
      cardNumber: this.cardNumber,
      expiryMonth: parsedExpiryMonth,
      expiryYear: parsedExpiryYear,
      cvc: parsedCvc,
      cardholderName: this.cardholderName
    };

    this.paymentService.processPayment(payload).subscribe({
      next: (response) => {
        if (response.statusCode === 200) {
          console.log('Payment successful:', response);
          this.paymentStatus = 'success';
          this.paymentMessage = 'Payment processed successfully!';
          this.resetForm();

          // Redirect to home page after a short delay
          setTimeout(() => {
            this.router.navigate(['/body']); // Navigate to /body (home page)
          }, 2000); // Redirect after 2 seconds
        } else {
          this.paymentStatus = 'error';
          this.paymentMessage = response.message || 'Payment failed. Please try again.';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.paymentStatus = 'error';
        this.paymentMessage = err.message || 'An error occurred during payment processing.';
        this.isLoading = false;
      }
    });
  }

  resetForm(): void {
    this.cardNumber = '';
    this.expiryMonth = '';
    this.expiryYear = '';
    this.cvc = '';
    this.cardholderName = '';
  }

  onYearInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    this.expiryYear = value;
    input.value = value;
  }

  onMonthInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');
    if (value.length > 2) {
      value = value.substring(0, 2);
    }
    this.expiryMonth = value;
    input.value = value;
  }

  onCvcInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    this.cvc = value;
    input.value = value;
  }

  ngOnDestroy(): void {
    // Cleanup code if needed
  }
}
