<!-- ProfanityFilterToggle.svelte - A simple toggle component for the profanity filter -->
<script lang="ts">
    import { onMount, afterUpdate } from 'svelte';
    import { profanityFilter } from '$lib/components/main/ProfanityFilter';
    import { filterEnabled } from '$lib/components/main/profanityFilterStore';
    
    // Props
    export let showLabel = true;
    
    // Local state for the toggle using a reactive declaration
    $: checked = $filterEnabled; // Subscribe to the store value directly
    
    // Load saved preference from localStorage
    onMount(() => {
      try {
        const savedPreference = localStorage.getItem('ergoChat_profanityFilter');
        if (savedPreference !== null) {
          const isEnabled = savedPreference === 'true';
          filterEnabled.set(isEnabled); // Update the store, which will update checked
          profanityFilter.setEnabled(isEnabled);
          console.log(`onMount: Loaded profanity filter preference: ${isEnabled}`);
        }
      } catch (error) {
        console.error("Error loading profanity filter preference:", error);
      }
    });
    
    // For debugging - log whenever the component updates
    afterUpdate(() => {
      console.log(`Component updated, checked = ${checked}, store value = ${$filterEnabled}`);
    });
    
    // Handle toggle change
    function handleToggle() {
      // Update the store instead of local state
      filterEnabled.set(!$filterEnabled);
      profanityFilter.setEnabled(!$filterEnabled);
      
      // Save preference to localStorage
      try {
        localStorage.setItem('ergoChat_profanityFilter', (!$filterEnabled).toString());
        console.log(`Toggle clicked: Setting filter to ${!$filterEnabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error("Error saving profanity filter preference:", error);
      }
    }
  </script>
  
  <div class="filter-toggle">
    <label class="toggle">
      <input 
        type="checkbox" 
        checked={$filterEnabled}
        on:change={handleToggle}
        aria-label="Toggle profanity filter"
      >
      <span class="toggle-slider"></span>
    </label>
    
    {#if showLabel}
      <span class="toggle-label">
        {$filterEnabled ? 'Profanity Filter On' : 'Profanity Filter Off'}
      </span>
    {/if}
  </div>
  
  <style>
    .filter-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-right: 0.75rem;
    }
    
    .toggle {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
    }
    
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #555;
      transition: .4s;
      border-radius: 34px;
    }
    
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .toggle-slider {
      background-color: #FF5500;
    }
    
    input:focus + .toggle-slider {
      box-shadow: 0 0 1px #FF5500;
    }
    
    input:checked + .toggle-slider:before {
      transform: translateX(16px);
    }
    
    .toggle-label {
      font-size: 0.8rem;
      color: #DDD;
      white-space: nowrap;
    }
  </style>