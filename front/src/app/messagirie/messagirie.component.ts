import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagerieService, Message, Conversation } from '../services/messagerie.service';
import { AuthService } from '../services/authService';
import { UnreadMessageService } from '../services/unread-message.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-messagirie',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    RouterLink
  ],
  templateUrl: './messagirie.component.html',
  styleUrl: './messagirie.component.css'
})
export class MessagirieComponent implements OnInit {
  conversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;
  messages: Message[] = [];
  messageInput: string = '';
  currentUserId: number | null = null;
  isLoadingMessages = false;
  isLoadingConversations = false;

  private messagerieService = inject(MessagerieService);
  private authService = inject(AuthService);
  private unreadMessageService = inject(UnreadMessageService);

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user?.id || null;
    if (this.currentUserId) {
      this.loadConversations();
    }
  }

  loadConversations() {
    if (!this.currentUserId) return;
    this.isLoadingConversations = true;
    this.messagerieService.getUserConversations(this.currentUserId).subscribe({
      next: (res) => {
        this.conversations = res.data;
        this.isLoadingConversations = false;
        // Auto-select the first conversation if available
        if (this.conversations.length > 0) {
            this.selectConversation(this.conversations[0]);
        }
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        this.isLoadingConversations = false;
      }
    });
  }

  selectConversation(convo: Conversation) {
    this.selectedConversation = convo;
    this.messages = []; // Clear previous messages
    this.loadMessages();
    // Mark as read
    if (this.currentUserId) {
      // The endpoint expects senderId (other user) and receiverId (current user)
      this.messagerieService.markMessagesAsRead(convo.other_user_id, this.currentUserId).subscribe({
        next: () => {
          // Notify the navbar to update unread count
          this.unreadMessageService.notifyMessagesRead();
          // Optionally, update the unread count in the local conversations list
           if (this.selectedConversation) {
               this.selectedConversation.unread_count = 0;
           }
        },
        error: (err) => {
             console.error('Error marking messages as read:', err);
        }
      });
    }
  }

  loadMessages() {
    if (!this.selectedConversation || !this.currentUserId) return;
    this.isLoadingMessages = true;
    
    // The endpoint is /conversation/:userId1/:userId2.
    // Let's call it with current user ID and the other user's ID.
    // The service method is getConversation(receiverId, senderId).
    // We are fetching the history, so the roles might not be strict receiver/sender in the endpoint.
    // Let's use the other_user_id and currentUserId for the service call.
    // The order in the URL doesn't necessarily dictate sender/receiver for a history endpoint.

    this.messagerieService.getConversation(this.currentUserId, this.selectedConversation.other_user_id).subscribe({
      next: (res) => {
        this.messages = res.data;
        this.isLoadingMessages = false;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Error loading messages:', err);
        this.isLoadingMessages = false;
      }
    });
  }

  sendMessage() {
    if (!this.messageInput.trim() || !this.selectedConversation || !this.currentUserId) return;
    const receiverId = this.selectedConversation.other_user_id; // Receiver is the other user in the conversation
    const senderId = this.currentUserId; // Sender is the current user

    this.messagerieService.sendMessage(senderId, receiverId, this.messageInput.trim()).subscribe({
      next: (res) => {
        console.log('Message sent:', res);
        this.messageInput = '';
        // Instead of reloading all messages, ideally push the new message
        // For simplicity, let's reload for now, but pushing is better for UX
        this.loadMessages();
        // Also update the last message and time in the conversations list
        if (this.selectedConversation) {
          // Assuming backend returns the sent message with updated timestamp and message content
          if(res.data) {
             this.selectedConversation.last_message = res.data.message; 
             this.selectedConversation.last_message_time = res.data.timestamp; // Use timestamp from response
          } else {
              // Fallback if backend doesn't return data, use local data (less accurate timestamp)
              this.selectedConversation.last_message = this.messageInput.trim();
              this.selectedConversation.last_message_time = new Date().toISOString();
          }
          // You might also need to update unread_count for the other user if needed, but usually this is for incoming.
        }
      },
      error: (err) => {
        console.error('Error sending message:', err);
        // Show error feedback to the user
      }
    });
  }

  scrollToBottom() {
    const el = document.getElementById('messages-list');
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  getAvatarUrl(conversation: Conversation): string {
      if (conversation.other_user_picture) {
          // Assuming backend returns a full URL or a path relative to assets
          return conversation.other_user_picture;
      } else {
          // Return path to your default avatar image in assets
          return 'assets/profile.jpg'; // Use profile.jpg as the default
      }
  }

  // Helper to format message timestamp if needed
  formatMessageTime(timestamp: string): string {
      // Use Angular DatePipe in template, or format here if complex logic
      // For simplicity, rely on DatePipe in HTML for now.
      return timestamp; // Placeholder
  }
}
