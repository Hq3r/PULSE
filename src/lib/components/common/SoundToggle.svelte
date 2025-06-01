<script lang="ts">
    import { onMount } from 'svelte';
    import { soundManager } from '$lib/utils/soundManager';
    
    let soundEnabled = false;
    
    onMount(() => {
      soundEnabled = soundManager.isSoundEnabled();
    });
    
    function toggleSound() {
      soundEnabled = soundManager.toggleSound();
    }
  </script>
  
  <button class="sound-toggle" on:click={toggleSound} title={soundEnabled ? 'Disable sound alerts' : 'Enable sound alerts'}>
    {#if soundEnabled}
      <i class="fa-solid fa-volume-high"></i>
    {:else}
      <i class="fa-solid fa-volume-xmark"></i>
    {/if}
  </button>
  
  <style>
    .sound-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1rem;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 50%;
      transition: all 0.2s ease;
      width: 2rem;
      height: 2rem;
    }
    
    .sound-toggle:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: #FFFFFF;
    }
  </style>
  