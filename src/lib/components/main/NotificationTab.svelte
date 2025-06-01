<!-- NotificationTab.svelte (New Component) -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { writable } from 'svelte/store';
    import { connected_wallet_address } from '$lib/store/store';
    import { truncateAddress } from '$lib/utils/utils';
    import { selectedChatroomId } from '$lib/components/main/chatstore';
    
    // Notification store
    const notifications = writable([]);
    let unreadCount = 0;
    
    // Track if panel is open
    let isOpen = false;
    
    onMount(() => {
      // Subscribe to message events from chatstore
      const unsubscribe = subscribeToNotifications((newNotifications) => {
        notifications.update(current => {
          // Merge and deduplicate notifications
          const merged = [...current, ...newNotifications];
          // Count unread
          unreadCount = merged.filter(n => !n.read).length;
          return merged;
        });
      });
      
      return () => {
        unsubscribe();
      };
    });
    
    function markAllAsRead() {
      notifications.update(items => {
        return items.map(item => ({...item, read: true}));
      });
      unreadCount = 0;
    }
    
    function navigateToMessage(notification) {
      // Switch to the proper chatroom if needed
      if (notification.chatroomId !== $selectedChatroomId) {
        selectedChatroomId.set(notification.chatroomId);
      }
      
      // Mark as read
      markAsRead(notification.id);
      
      // Close panel
      isOpen = false;
      
      // Dispatch event to scroll to and highlight the message
      dispatch('navigateToMessage', {
        messageId: notification.messageId
      });
    }
    
    function markAsRead(notificationId) {
      notifications.update(items => {
        return items.map(item => 
          item.id === notificationId 
            ? {...item, read: true} 
            : item
        );
      });
      
      // Update unread count
      notifications.subscribe(items => {
        unreadCount = items.filter(n => !n.read).length;
      })();
    }
  </script>
  
  <div class="notification-container">
    <!-- Notification Bell Icon with Badge -->
    <button class="notification-btn" on:click={() => isOpen = !isOpen}>
      <i class="fa-solid fa-bell"></i>
      {#if unreadCount > 0}
        <span class="notification-badge">{unreadCount}</span>
      {/if}
    </button>
    
    <!-- Notification Panel -->
    {#if isOpen}
      <div class="notification-panel">
        <div class="notification-header">
          <h3>Notifications</h3>
          <div class="notification-actions">
            <button class="action-btn" on:click={markAllAsRead}>
              Mark all as read
            </button>
            <button class="close-btn" on:click={() => isOpen = false}>
              <i class="fa-solid fa-times"></i>
            </button>
          </div>
        </div>
        
        <div class="notification-list">
          {#each $notifications as notification}
            <div 
              class="notification-item {notification.read ? '' : 'unread'}" 
              on:click={() => navigateToMessage(notification)}
            >
              <div class="notification-icon">
                <i class="fa-solid fa-reply"></i>
              </div>
              <div class="notification-content">
                <div class="notification-text">
                  <span class="notification-sender">{truncateAddress(notification.sender)}</span>
                  replied to your message
                </div>
                <div class="notification-preview">"{notification.preview}"</div>
                <div class="notification-time">{formatTime(notification.timestamp)}</div>
              </div>
              <button 
                class="mark-read-btn" 
                on:click|stopPropagation={() => markAsRead(notification.id)}
                title="Mark as read"
              >
                <i class="fa-solid {notification.read ? 'fa-check' : 'fa-circle'}"></i>
              </button>
            </div>
          {/each}
          
          {#if $notifications.length === 0}
            <div class="empty-notifications">
              <i class="fa-solid fa-bell-slash"></i>
              <p>No notifications yet</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    /* Notification styles would go here */
  </style>