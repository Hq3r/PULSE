<!-- EmojiPicker.svelte - Component for emoji selection -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    
    // Event dispatcher to communicate with parent component
    const dispatch = createEventDispatcher();
    
    // Common emoji categories
    const emojiCategories = [
      {
        name: "Frequently Used",
        icon: "🕒",
        emojis: ["👍", "❤️", "😊", "😂", "🙏", "🔥", "👏", "✅", "🎉", "🚀"]
      },
      {
        name: "Smileys",
        icon: "😀",
        emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘"]
      },
      {
        name: "People",
        icon: "👨",
        emojis: ["👋", "🤚", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏"]
      },
      {
        name: "Animals",
        icon: "🐱",
        emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴"]
      },
      {
        name: "Food",
        icon: "🍔",
        emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "☕", "🍵", "🫖", "🥤"]
      },
      {
        name: "Activities",
        icon: "⚽",
        emojis: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸", "🤺", "⛹️", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🎪", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🎻", "🎲", "♟️", "🎯", "🎳", "🎮", "🎰", "🧩"]
      },
      {
        name: "Travel",
        icon: "🚗",
        emojis: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🛵", "🏍️", "🛺", "🚲", "🛴", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛩️", "💺", "🛰️", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "🛟", "⚓", "🪝", "⛽", "🚧", "🚦", "🚥", "🚏", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️", "⛺", "🛖", "🏠", "🏡", "🏘️", "🏚️", "🏗️", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪", "🏫", "🏩", "💒", "🏛️", "⛪", "🕌", "🕍", "🛕", "🕋", "⛩️"]
      },
      {
        name: "Objects",
        icon: "💡",
        emojis: ["⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "💎", "⚖️", "🪮", "🔧", "🔨", "⚒️", "🛠️", "⛏️", "🪓", "🔩", "⚙️", "🪜", "🧱", "⛓️", "🧲", "🔫", "💣", "🧨", "🪓", "🔪", "🗡️", "⚔️", "🛡️", "🚬", "⚰️", "🪦", "⚱️", "🏺", "🔮", "📿", "🧿", "💈", "⚗️", "🔭", "🔬", "🕳️", "🩻", "🩹", "🩼", "💊", "💉", "🩸", "🧬", "🦠", "🧫", "🧪", "🌡️", "🧹", "🪠", "🧺", "🧻", "🚽", "🚰", "🚿", "🛁", "🛀", "🧼", "🪥", "🪒", "🧽", "🪣", "🧴", "🛎️", "🔑", "🗝️", "🚪", "🪑", "🛋️", "🛏️", "🛌", "🧸", "🪆", "🖼️", "🪞", "🪟", "🛍️", "🛒", "🎁", "🎈", "🎏", "🎀", "🪄", "🪅", "🎊", "🎉", "🎎", "🏮", "🎐", "🧧", "✉️", "📩", "📨", "📧", "💌", "📥", "📤", "📦", "🏷️", "🪧", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃", "📄", "📑", "🧾", "📊", "📈", "📉", "🗒️", "🗓️", "📆", "📅", "🗑️", "📇", "🗃️", "🗳️", "🗄️", "📋", "📁", "📂", "🗂️", "🗞️", "📰", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📖", "🔖", "🧷", "🔗", "📎", "🖇️", "📐", "📏", "🧮", "📌", "📍", "✂️", "🖊️", "🖋️", "✒️", "🖌️", "🖍️", "📝", "✏️", "🔍", "🔎", "🔏", "🔐", "🔒", "🔓"]
      },
      {
        name: "Symbols",
        icon: "💯",
        emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "❤️‍🔥", "❤️‍🩹", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳", "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "💮", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑", "🅾️", "🆘", "❌", "⭕", "🛑", "⛔", "📛", "🚫", "💯", "💢", "♨️", "🚷", "🚯", "🚳", "🚱", "🔞", "📵", "🚭", "❗", "❕", "❓", "❔", "‼️", "⁉️", "🔅", "🔆", "〽️", "⚠️", "🚸", "🔱", "⚜️", "🔰", "♻️", "✅", "🈯", "💹", "❇️", "✳️", "❎", "🌐", "💠", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿", "🅿️", "🛗", "🈳", "🈂️", "🛂", "🛃", "🛄", "🛅", "🚹", "🚺", "🚼", "⚧", "🚻", "🚮", "🎦", "📶", "🈁", "🔣", "ℹ️", "🔤", "🔡", "🔠", "🆖", "🆗", "🆙", "🆒", "🆕", "🆓", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "🔢", "#️⃣", "*️⃣", "⏏️", "▶️", "⏸️", "⏯️", "⏹️", "⏺️", "⏭️", "⏮️", "⏩", "⏪", "⏫", "⏬", "◀️", "🔼", "🔽", "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "↪️", "↩️", "⤴️", "⤵️", "🔀", "🔁", "🔂", "🔄", "🔃", "🎵", "🎶", "〰️", "➰", "➿", "🔚", "🔙", "🔛", "🔝", "🔜", "✔️", "☑️", "🔘", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "🔺", "🔻", "🔸", "🔹", "🔶", "🔷", "🔳", "🔲", "▪️", "▫️", "◾", "◽", "◼️", "◻️", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛", "⬜", "🟫", "🔈", "🔇", "🔉", "🔊", "🔔", "🔕", "📣", "📢", "👁️‍🗨️", "💬", "💭", "🗯️", "♠️", "♣️", "♥️", "♦️", "🃏", "🎴", "🀄", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛", "🕜", "🕝", "🕞", "🕟", "🕠", "🕡", "🕢", "🕣", "🕤", "🕥", "🕦", "🕧"]
      },
      {
        name: "Crypto",
        icon: "₿",
        emojis: ["₿", "⟠", "ℏ", "₳", "⚡", "🔐", "🔒", "🧮", "📈", "📉", "💰", "💎", "🌐", "🚀", "🔗", "🌑", "🌕", "🧠", "🤖", "🗝️", "💻", "🎮", "📊", "👨‍💻", "👩‍💻", "🦊", "🐂", "🐻"]
      }
    ];
    
    let selectedCategory = emojiCategories[0];
    let isVisible = false;
    let searchQuery = '';
    let recentEmojis: string[] = [];
    
    // Load recent emojis from localStorage
    onMount(() => {
      try {
        const stored = localStorage.getItem('ergoChat_recentEmojis');
        if (stored) {
          recentEmojis = JSON.parse(stored);
          // Update the first category with recent emojis
          if (recentEmojis.length > 0) {
            emojiCategories[0].emojis = recentEmojis.slice(0, 10);
          }
        }
      } catch (error) {
        console.error('Error loading recent emojis:', error);
      }
    });
    
    // Save emoji to recent list
    function saveToRecent(emoji: string) {
      // Add to front of array
      recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 10);
      // Update localStorage
      localStorage.setItem('ergoChat_recentEmojis', JSON.stringify(recentEmojis));
      // Update the first category
      emojiCategories[0].emojis = recentEmojis;
    }
    
    // Handle emoji selection
    function selectEmoji(emoji: string) {
      dispatch('select', { emoji });
      saveToRecent(emoji);
      // Optional: close picker after selection
      // isVisible = false;
    }
    
    // Toggle visibility of emoji picker
    function togglePicker() {
      isVisible = !isVisible;
    }
    
    // Handle clicks outside to close picker
    function handleClickOutside(event) {
      // Check if click is outside the picker and button
      const target = event.target;
      const picker = document.querySelector('.emoji-picker');
      const button = document.querySelector('.emoji-button');
      
      if (picker && button && !picker.contains(target) && !button.contains(target)) {
        isVisible = false;
      }
    }
    
    // Set up click outside listener when picker is visible
    $: if (isVisible) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
    
    // Filter emojis based on search query
    $: filteredEmojis = searchQuery
      ? Array.from(new Set(
          emojiCategories.flatMap(category => 
            category.emojis.filter(emoji => 
              emoji.includes(searchQuery.toLowerCase())
            )
          )
        ))
      : [];
  </script>
  
  <div class="emoji-container">
    <button 
      type="button"
      class="emoji-button" 
      on:click={togglePicker} 
      aria-label="Open emoji picker"
    >
      <i class="fa-regular fa-face-smile"></i>
    </button>
    
    {#if isVisible}
      <div class="emoji-picker">
        <div class="emoji-picker-header">
          <input 
            type="text" 
            class="emoji-search" 
            placeholder="Search emojis..." 
            bind:value={searchQuery} 
          />
        </div>
        
        {#if searchQuery && filteredEmojis.length > 0}
          <div class="emoji-search-results">
            {#each filteredEmojis as emoji}
              <button 
                type="button" 
                class="emoji-item" 
                on:click={() => selectEmoji(emoji)}
              >
                {emoji}
              </button>
            {/each}
          </div>
        {:else if searchQuery && filteredEmojis.length === 0}
          <div class="emoji-no-results">No emojis found</div>
        {:else}
          <div class="emoji-categories">
            {#each emojiCategories as category}
              <button 
                type="button"
                class="category-button" 
                class:active={selectedCategory === category}
                on:click={() => selectedCategory = category}
                title={category.name}
              >
                {category.icon}
              </button>
            {/each}
          </div>
          
          <div class="emoji-list">
            <h3 class="category-title">{selectedCategory.name}</h3>
            <div class="emoji-grid">
              {#each selectedCategory.emojis as emoji}
                <button 
                  type="button" 
                  class="emoji-item" 
                  on:click={() => selectEmoji(emoji)}
                  title={emoji}
                >
                  {emoji}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
  
  <style>
    .emoji-container {
      position: relative;
      display: inline-block;
    }
    
    .emoji-button {
      background: none;
      border: none;
      color: #999;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }
    
    .emoji-button:hover {
      background-color: rgba(255, 85, 0, 0.1);
      color: #FF5500;
    }
    
    .emoji-picker {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 0;
      width: 320px;
      max-height: 400px;
      background-color: #262626;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      overflow: visible;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.2s ease;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .emoji-picker-header {
      padding: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .emoji-search {
      width: 100%;
      padding: 0.5rem;
      border: none;
      border-radius: 4px;
      background-color: #333;
      color: white;
    }
    
    .emoji-categories {
      display: flex;
      overflow-x: auto;
      padding: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      scrollbar-width: thin;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      white-space: nowrap;
    }
    
    .category-button {
      background: none;
      border: none;
      color: #999;
      min-width: 2rem;
      height: 2rem;
      margin-right: 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-block;
      padding: 0.25rem;
      font-size: 1.1rem;
    }
    
    .category-button:hover, .category-button.active {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
    }
    
    .emoji-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
      max-height: 250px;
    }
    
    .emoji-search-results {
      padding: 0.75rem;
      max-height: 300px;
      overflow-y: auto;
      display: flex;
      flex-wrap: wrap;
    }
    
    .category-title {
      margin: 0 0 0.5rem 0;
      font-size: 0.85rem;
      color: #aaa;
      font-weight: 500;
    }
    
    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 0.5rem;
    }
    
    .emoji-item {
      width: 100%;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 4px;
      font-size: 1.25rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .emoji-item:hover {
      background-color: rgba(255, 85, 0, 0.2);
      transform: scale(1.15);
    }
    
    .emoji-no-results {
      padding: 2rem;
      text-align: center;
      color: #999;
    }
    
    /* scrollbar styles */
    .emoji-list::-webkit-scrollbar,
    .emoji-search-results::-webkit-scrollbar,
    .emoji-categories::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    .emoji-list::-webkit-scrollbar-track,
    .emoji-search-results::-webkit-scrollbar-track,
    .emoji-categories::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1);
    }
    
    .emoji-list::-webkit-scrollbar-thumb,
    .emoji-search-results::-webkit-scrollbar-thumb,
    .emoji-categories::-webkit-scrollbar-thumb {
      background: rgba(255, 85, 0, 0.5);
      border-radius: 4px;
    }
    
    /* Small screen adjustments */
    @media (max-width: 480px) {
      .emoji-picker {
        width: 290px;
        left: -100px;
      }
      
      .emoji-grid {
        grid-template-columns: repeat(6, 1fr);
      }
    }emoji-item {
      width: 100%;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 4px;
      font-size: 1.25rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .emoji-item:hover {
      background-color: rgba(255, 85, 0, 0.2);
      transform: scale(1.15);
    }
    
    .emoji-no-results {
      padding: 2rem;
      text-align: center;
      color: #999;
    }
    
    /* scrollbar styles */
    .emoji-list::-webkit-scrollbar,
    .emoji-search-results::-webkit-scrollbar,
    .emoji-categories::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    .emoji-list::-webkit-scrollbar-track,
    .emoji-search-results::-webkit-scrollbar-track,
    .emoji-categories::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1);
    }
    
    .emoji-list::-webkit-scrollbar-thumb,
    .emoji-search-results::-webkit-scrollbar-thumb,
    .emoji-categories::-webkit-scrollbar-thumb {
      background: rgba(255, 85, 0, 0.5);
      border-radius: 4px;
    }
    
    /* Small screen adjustments */
    @media (max-width: 480px) {
      .emoji-picker {
        width: 290px;
        left: -100px;
      }
      
      .emoji-grid {
        grid-template-columns: repeat(6, 1fr);
      }
    }
  </style>