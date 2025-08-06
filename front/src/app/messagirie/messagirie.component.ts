import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagerieService, Message, Conversation } from '../services/messagerie.service';
import { AuthService } from '../services/authService';
import { UnreadMessageService } from '../services/unread-message.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';

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
  selectedConversation: (Conversation & { isTemporaryStaticConversation?: boolean }) | null = null;
  messages: Message[] = [];
  messageInput: string = '';
  currentUserId: number | null = null;
  isLoadingMessages = false;
  isLoadingConversations = false;

  constructor(
    private route: ActivatedRoute,
    private messagerieService: MessagerieService,
    private authService: AuthService,
    private unreadMessageService: UnreadMessageService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user?.id || null;

    if (!this.currentUserId) {
      // Handle unauthenticated user, maybe redirect or show error
      console.error('User not authenticated for messaging.');
      return;
    }

    // Process query parameters for a static conversation first
    const queryParams = this.route.snapshot.queryParams;
    const clientId = Number(queryParams['clientId']);
    const clientName = queryParams['clientName'];
    const clientPicture = queryParams['clientPicture'] === 'null' ? null : queryParams['clientPicture'];
    const startConversationParam = queryParams['startConversation'];

    if (clientId && startConversationParam) {
      // If a static conversation is requested via query params, create and select it immediately
      // This ensures it appears in the sidebar as soon as the component loads.
      this.createAndSelectTemporaryConversation(clientId, clientName, clientPicture);
    }

    // Load actual conversations from backend. This will run after the potential static conversation setup.
    this.loadConversations();
  }

  loadConversations() {
    if (!this.currentUserId) return;

    this.isLoadingConversations = true;
    this.messagerieService.getUserConversations(this.currentUserId).subscribe({
      next: (res) => {
        // Filter out any existing temporary static conversation if a real one for that client exists in the loaded data
        let loadedConversations = res.data;
        if (this.selectedConversation?.isTemporaryStaticConversation) {
          const realConvoExists = loadedConversations.some(convo => convo.other_user_id === this.selectedConversation?.other_user_id);
          if (realConvoExists) {
            // If a real conversation for this client exists, we should replace the temporary one.
            // We'll update the selectedConversation to the real one later if it's the right client.
            this.selectedConversation = loadedConversations.find(convo => convo.other_user_id === this.selectedConversation?.other_user_id) || null;
          }
        }

        // Merge conversations, ensuring no duplicates and temporary one stays if no real one found yet
        const uniqueConversations = new Map<number, Conversation>();
        
        // Add all loaded conversations, preferring them over temporary ones if IDs match
        loadedConversations.forEach(convo => uniqueConversations.set(convo.other_user_id, convo));

        // If a temporary static conversation is still selected and not replaced by a real one, add it to the map
        if (this.selectedConversation?.isTemporaryStaticConversation) {
          uniqueConversations.set(this.selectedConversation.other_user_id, this.selectedConversation);
        }
        
        // Convert map back to array and sort to keep the order consistent (e.g., by last message time)
        this.conversations = Array.from(uniqueConversations.values()).sort((a, b) => {
          return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
        });

        this.isLoadingConversations = false;

        // If no conversation is currently selected (e.g., on initial load without query params),
        // select the first available conversation from the merged list.
        if (!this.selectedConversation && this.conversations.length > 0) {
            this.selectConversation(this.conversations[0]);
        } else if (this.selectedConversation?.other_user_id) {
          // Ensure the currently selected conversation (which might be temporary or a real one now)
          // is correctly loaded in terms of messages if it's no longer temporary.
          this.selectConversation(this.selectedConversation);
        }
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        this.isLoadingConversations = false;
        // Ensure a temporary static conversation stays selected if loading fails
        if (!this.selectedConversation?.isTemporaryStaticConversation) {
          this.selectedConversation = null; // No conversations to select if loading fails and no temporary one
        }
      }
    });
  }

  selectConversation(convo: Conversation) {
    this.selectedConversation = convo;
    this.messages = []; // Always clear messages when selecting a new conversation

    // Only load messages and mark as read if it's an existing, non-temporary conversation
    if (!convo.isTemporaryStaticConversation) {
    this.loadMessages();
      // Mark messages as read for existing conversations
    if (this.currentUserId) {
      this.messagerieService.markMessagesAsRead(convo.other_user_id, this.currentUserId).subscribe({
        next: () => {
          this.unreadMessageService.notifyMessagesRead();
           if (this.selectedConversation) {
               this.selectedConversation.unread_count = 0;
           }
        },
        error: (err) => {
             console.error('Error marking messages as read:', err);
        }
      });
      }
    } else {
      // For a temporary static conversation, ensure message area is empty
      this.messages = [];
      this.messageInput = '';
    }
  }

  loadMessages() {
    if (!this.selectedConversation || !this.currentUserId || this.selectedConversation.isTemporaryStaticConversation) {
      return; // Do not load messages for temporary static conversations
    }
    this.isLoadingMessages = true;

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
    if (!this.messageInput.trim() || !this.selectedConversation || !this.currentUserId) {
      return;
    }

    const receiverId = this.selectedConversation.other_user_id;
    const senderId = this.currentUserId;
    const messageContent = this.messageInput.trim();

    // Capture the temporary status before sending
    const wasTemporary = this.selectedConversation.isTemporaryStaticConversation;

    this.messagerieService.sendMessage(senderId, receiverId, messageContent).subscribe({
      next: (res) => {
        console.log('Message sent:', res);
        this.messageInput = '';

        // If it was a temporary conversation, mark it as real now and update its status in the list
        if (wasTemporary && this.selectedConversation) {
          this.selectedConversation.isTemporaryStaticConversation = false; // It's no longer temporary
          // The conversation object is already in this.conversations list; its flag is just updated.
          // Update its last message and time, as sendMessage might not return these consistently.
          this.selectedConversation.last_message = messageContent;
          this.selectedConversation.last_message_time = new Date().toISOString();
        }
        
        this.loadMessages(); // Reload messages to include the new one (and ensure it's loaded as a real convo)

        // Optimistically update the last message in the sidebar for the selected conversation
        if (this.selectedConversation) {
          this.selectedConversation.last_message = messageContent;
              this.selectedConversation.last_message_time = new Date().toISOString();
        }
      },
      error: (err) => {
        console.error('Error sending message:', err);
        alert('Failed to send message. Please try again.');
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
          return conversation.other_user_picture;
      } else {
      return 'assets/profile.jpg'; // Default avatar
      }
  }

  formatMessageTime(timestamp: string): string {
    return timestamp;
  }

  private createAndSelectTemporaryConversation(clientId: number, clientName: string, clientPicture: string | null) {
    if (!this.currentUserId) return;

    // Check if a temporary conversation for this client is already active
    if (this.selectedConversation?.isTemporaryStaticConversation && this.selectedConversation.other_user_id === clientId) {
      return; // Already showing the temporary conversation, do nothing
    }

    const tempConversation: Conversation & { isTemporaryStaticConversation?: boolean } = {
      other_user_id: clientId,
      other_user_name: clientName || `Client ${clientId}`,
      other_user_picture: clientPicture,
      last_message: '', // Empty initially
      last_message_time: new Date().toISOString(),
      unread_count: 0,
      last_message_sender_id: this.currentUserId as number,
      isTemporaryStaticConversation: true
    };

    // Remove any existing temporary conversation from the list to avoid duplicates
    this.conversations = this.conversations.filter(c => !c.isTemporaryStaticConversation);

    // Add the new temporary conversation to the very top of the conversations list
    this.conversations.unshift(tempConversation);

    // Select this temporary conversation
    this.selectConversation(tempConversation);
  }
}
