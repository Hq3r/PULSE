<script lang="ts">
    import Landing from '$lib/components/main/Landing.svelte';
    import {
        loadOffersPackage,
        loadOffersSolo,
        setOffersFilter,
        preloaded
    } from '$lib/store/store.ts';
    import { onMount } from 'svelte';
    let loading = false;
    onMount(init);
    function init() {
        if ($preloaded) {
            return;
        }
        setOffersFilter(null, null, null, null, null, null);
        loadOffersPackage();
        loadOffersSolo();
    }
</script>
<div class="h-full flex flex-col grow main-page">
    {#if loading}
        <div class="grow flex flex-col items-center justify-center">
            <!-- Ergo Chat Loading Animation -->
            <div class="chat-loading-container">
                <div class="chat-loading-title">
                    <span class="ergo-text">ERGO</span>ON
                </div>
                
                <div class="chat-loading-box">
                    <div class="message-bubbles">
                        <div class="message-bubble bubble-1"></div>
                        <div class="message-bubble bubble-2"></div>
                        <div class="message-bubble bubble-3"></div>
                    </div>
                    
                    <div class="blockchain-animation">
                        {#each Array(6) as _, i}
                            <div class="block" style="animation-delay: {i * 0.15}s;"></div>
                        {/each}
                    </div>
                </div>
                
                <div class="chat-loading-text">Connecting to blockchain<span class="dot-1">.</span><span class="dot-2">.</span><span class="dot-3">.</span></div>
            </div>
        </div>
    {:else}
        <Landing />
    {/if}
</div>
<style lang="postcss">
    :global(html) {
        background-color: #1b2845;
        background-image: linear-gradient(315deg, #1b2845 0%, #274060 74%);
        background-image: linear-gradient(315deg, #1b2845 0%, #274060 74%);
        background-image: radial-gradient(circle, #2a2a2a, #1b2845);
        /* background-image: linear-gradient(315deg, #4B0082 0%, #000000 74%); */
        min-height: 100vh;
    }
    :global(body) {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        color: #d1d1d1;
        /* color: #C0A080; */
    }
    :global(button.btn) {
        background-color: #d1d1d1;
        color: #263962;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: 0.3s;
        font-weight: 500;
    }
    :global(button.btn:hover) {
        background-color: #eeeeee; /* Slightly darker for hover effect */
    }
    :global(button.btn-secondary) {
        background-color: #6c84a2;
        color: #e0dfdf;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: 0.3s;
        font-weight: 500;
    }
    :global(button.btn-secondary:hover) {
        background-color: #a1c0d9; /* Slightly darker for hover effect */
        color: black;
    }
    .main-page {
        background-position: cover;
        background-repeat: no-repeat;
    }
    
    /* Ergo Chat Loading Animation */
    .chat-loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
    }
    
    .chat-loading-title {
        font-size: 1.8rem;
        font-weight: 700;
        margin-bottom: 20px;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    }
    
    .ergo-text {
        color: #FF5500;
        font-weight: 900;
    }
    
    .chat-loading-box {
        width: 280px;
        height: 180px;
        background-color: #1A1A1A;
        border-radius: 12px;
        padding: 15px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 85, 0, 0.3);
    }
    
    .message-bubbles {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
    
    .message-bubble {
        height: 12px;
        background-color: #262626;
        border-radius: 8px;
        opacity: 0.8;
        animation: bubble-fade 2s infinite;
    }
    
    .bubble-1 {
        width: 80%;
        animation-delay: 0s;
    }
    
    .bubble-2 {
        width: 60%;
        animation-delay: 0.3s;
    }
    
    .bubble-3 {
        width: 40%;
        align-self: flex-end;
        background-color: rgba(255, 85, 0, 0.2);
        animation-delay: 0.6s;
    }
    
    @keyframes bubble-fade {
        0%, 100% {
            opacity: 0.4;
        }
        50% {
            opacity: 1;
        }
    }
    
    .blockchain-animation {
        position: absolute;
        bottom: 15px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: 0 15px;
    }
    
    .block {
        width: 30px;
        height: 30px;
        background-color: #333333;
        border-radius: 4px;
        position: relative;
        animation: block-up 2s infinite ease-in-out;
        border: 1px solid rgba(255, 85, 0, 0.3);
    }
    
    .block::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 6px;
        height: 6px;
        background-color: #FF5500;
        border-radius: 50%;
        opacity: 0.7;
    }
    
    @keyframes block-up {
        0%, 100% {
            transform: translateY(0);
            opacity: 0.5;
        }
        50% {
            transform: translateY(-10px);
            opacity: 1;
            box-shadow: 0 5px 15px rgba(255, 85, 0, 0.3);
        }
    }
    
    .chat-loading-text {
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        color: #fff;
        text-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
    }
    
    .dot-1, .dot-2, .dot-3 {
        animation: dot-fade 1.4s infinite;
        opacity: 0;
    }
    
    .dot-1 {
        animation-delay: 0s;
    }
    
    .dot-2 {
        animation-delay: 0.2s;
    }
    
    .dot-3 {
        animation-delay: 0.4s;
    }
    
    @keyframes dot-fade {
        0%, 100% {
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
    }
    
    /* Original Pixel Loading Animation - Keeping for reference */
    .pixel-loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
    }
    
    .pixel-canvas {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(8, 1fr);
        gap: 4px;
        width: 220px;
        height: 220px;
        border-radius: 4px;
        background-color: rgba(0, 0, 0, 0.2);
        padding: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .loading-pixel {
        background-color: #FF5500;
        border-radius: 2px;
        opacity: 0.2;
        animation: pixel-pulse 2s infinite;
        transform-origin: center;
    }
    
    @keyframes pixel-pulse {
        0%, 100% {
            opacity: 0.2;
            transform: scale(0.8);
        }
        50% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 15px rgba(255, 85, 0, 0.7);
        }
    }
    
    .pixel-loading-text {
        font-family: 'Courier New', monospace;
        font-size: 18px;
        color: #fff;
        text-shadow: 0 0 8px rgba(255, 85, 0, 0.7);
    }
</style>