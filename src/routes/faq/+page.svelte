<script lang="ts">
	import FAQ from '$lib/components/faq/FAQ.svelte';
</script>

<div class="h-full flex flex-col grow main-page">
	<FAQ />
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
</style>
