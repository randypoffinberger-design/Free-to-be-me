/* Caregiver-supplied resource collection, consolidated by provider. Links open the original creators' sites. */
(() => {
  'use strict';
  const resources = [
    {
      name: 'Sensory Shock', url: 'https://www.sensoryshock.com/',
      needs: ['Sensory exploration', 'Cause & effect', 'Visual stimulation', 'Auditory stimulation', 'Calm / regulation', 'Communication', 'Independent exploration'],
      access: ['Touchscreen', 'Mouse', 'Keyboard', 'Alternative access'],
      intro: 'Free browser activities, sensory tools, communication resources, and accessibility tools.',
      sections: [
        ['Activities', 'Explore visual and sound-based activities, regulation tools, communication resources, and interactive sensory play. Bubble Pop includes options for bubble size, color, sound, vibration, and automatic refill.'],
        ['Access and sensory choices', 'Features differ by tool. Options may include touch, mouse, keyboard, game controllers, and eye/head tracking on selected tools. Preview the individual activity and its sound, motion, and other settings before starting.'],
        ['Cost and setup', 'The free resources are browser-based and do not require an account. Follow each activity’s own device and access guidance.']
      ]
    },
    {
      name: 'LightGames', url: 'https://www.lightgames.org/',
      needs: ['Sensory exploration', 'Cause & effect', 'Visual stimulation', 'Auditory stimulation', 'Calm / regulation', 'Visual tracking', 'Independent exploration'],
      access: ['Eye gaze', 'Touchscreen', 'Mouse', 'Alternative access'],
      intro: 'Free sensory games designed around eye-gaze and eye-tracking interaction, with touch and mouse options.',
      sections: [
        ['Activities to explore', 'The supplied collection highlights Luminescent Orbs, Crystal Garden, Balloon Pop, Bubbles, Aurora Whales, Bloom Garden, Color Orbs, Ocean Animals Explorer, Calm Lights, Whale Ride, and Sky Balloons. Browse the current directory for available titles and its Sensory, Explore, Target, Choose, and Control categories.'],
        ['Access', 'Look for large targets, one-action or dwell-based interaction, and activities that do not need double-clicking. Choose a game that works with the child’s existing eye-gaze setup, touchscreen, or mouse.'],
        ['Sensory choices', 'Experiences vary in light, color, sound, movement, and music. Tags such as Music, Relax, No-timer, and High-stim can help distinguish gentle experiences from stronger input when present. Preview the game rather than assuming every sensory activity is calming.'],
        ['Cost and setup', 'Free browser-based games; the supplied collection lists no account or download requirement. Check the selected game for current access options.']
      ]
    },
    {
      name: 'Maggie Games', url: 'https://maggiegames.com/',
      needs: ['Sensory exploration', 'Cause & effect', 'Visual stimulation', 'Auditory stimulation', 'Calm / regulation', 'Fine motor', 'Hand-eye coordination', 'Visual tracking', 'Matching / sorting', 'Turn-taking', 'Early learning', 'Communication', 'Independent exploration', 'Printables'],
      access: ['Touchscreen', 'Mouse', 'Keyboard', 'Switch', 'Alternative access'],
      intro: 'Free accessible sensory, learning, and cause-and-effect games with large controls and adjustable levels.',
      sections: [
        ['Sensory exploration and calm play', 'Ripples, Colors, and Sparkles respond to touch, mouse, or keyboard input. Options include sound off, reduced motion, and Calm Mode for slower, less intense input. These activities have no score, timer, or wrong answer. Online fidgets offer another way to explore.'],
        ['Cause & effect: First Press', 'A tap or press can pop a balloon, reveal an animal, or make Maggie the dog react. Stages move from a simple action-and-response experience toward targeting. Explore sound, voice, and larger-target settings. Children learning intentional movement can participate at their own pace.'],
        ['Visual tracking and hand-eye coordination', 'Visual Tracking includes Watch (observe a moving ball), Catch (activate it when it stops), and Follow (follow with a finger or pointer). Hand-eye activities use targets and adjustable difficulty without requiring precise dragging. A trackball, joystick, or dwell-click setup may work when it supplies compatible pointer input; check it with the chosen activity.'],
        ['Matching, learning, and communication', 'Shadow Matching pairs photographs with silhouettes. Word-to-Picture Matching can be adjusted to the learner. Tic-Tac-Toe offers turn-taking, and Feelings Check-In helps a child indicate feelings and possible supports. Games use levels rather than age gates. Spoken instructions and optional written words let caregivers adjust reading demands. Speech is not required; voice can be turned off when it interferes with AAC.'],
        ['Switch access', 'Keyboard operation supports compatible USB/Bluetooth keyboard-emulating switches and device-level iOS/iPadOS Switch Control, Android Switch Access, ChromeOS Switch Access, and macOS Switch Control. Scanning comes from the device or interface, not from a scanner built into the game. Configure and test the child’s access system first. Large controls, no required dragging, no timers, and no losing screens allow time to respond.'],
        ['Free printable activities', 'Screen-free matching sheets include animals, vehicles, body parts, fruits and vegetables, and other themes. Choose by interest and number of choices. Print at the creator’s site, or use the sheets as matching cards when that is a better fit.'],
        ['Cost and setup', 'Free; no account or download is needed to play, and game pages have no ads. Printables are available as PDFs. These are everyday play and practice activities.']
      ],
      links: [['Free printables', 'https://maggiegames.com/printables/'], ['Switch access and setup', 'https://maggiegames.com/switch-accessible-games/']]
    },
    {
      name: 'Adaptatech', url: 'https://adaptatech.org/',
      needs: ['Sensory exploration', 'Visual stimulation', 'Auditory stimulation', 'Early learning', 'Independent exploration'],
      access: ['Eye gaze', 'Switch', 'Touchscreen', 'Mouse', 'Alternative access'],
      intro: 'A directory of adapted games and activities, including options for learners with multiple disabilities.',
      sections: [
        ['Sensory Lab', 'Explore 16 visual, sound, and music experiences designed for eye-gaze access and also usable with a mouse. An option pauses animations when the learner looks away.'],
        ['Other activities and access', 'Browse switch games, arcade activities, eye-control and touchscreen games, educational tools, and adapted activities. Choose the access method for the individual activity: eye gaze, switch, touch, or mouse.'],
        ['Cost, setup, and licensing', 'The browser-based collection is described as free forever and public domain under the Unlicense. The supplied collection lists no account requirement. MTM links to the original activities rather than hosting copies.']
      ]
    },
    {
      name: 'Gentle Games', url: 'https://www.gentlegames.org/',
      needs: ['Sensory exploration', 'Cause & effect', 'Visual stimulation', 'Auditory stimulation', 'Calm / regulation', 'Fine motor', 'Matching / sorting', 'Early learning', 'Creative play', 'Independent exploration'],
      access: ['Touchscreen', 'Mouse'],
      intro: 'Free, noncompetitive games with optional sound, large touch targets, and animations that can be turned off.',
      sections: [
        ['Matching and creative play', 'Memory Snap matches pairs with different themes and difficulty levels. Drawing Pad offers drawing, an eraser, shapes, colors, and undo. Category Match sorts pictures into Sky, Land, and Ocean; this activity uses dragging, so check that it fits the child’s access method.'],
        ['Sensory play', 'Glitter Fall lets children interact with falling particles. Bubble Pop offers bubbles to tap at a gentle pace. Keepy Uppy involves tapping a balloon to keep it in the air. The site describes no flashing or jarring effects and no timers that penalize play, although Memory Snap displays elapsed time.'],
        ['Additional activities in the supplied collection', 'Breathing Garden follows a visual breathing rhythm, and Pattern Train involves completing visual patterns. These two titles were included in the caregiver’s collection but were not listed on the provider’s current overview when checked; check the live games collection for availability.'],
        ['Cost and setup', 'Free, with no ads or in-app purchases; the supplied collection lists no account needed to play. The project is open source under GNU GPLv3. Follow the provider’s Play Games link for the current collection.']
      ],
      links: [['Open the games collection', 'https://games.gentlegames.org/']]
    }
  ];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options = key => [...new Set(resources.flatMap(r => r[key]))].sort().map(value => `<option>${escape(value)}</option>`).join('');
  const link = (label, url) => `<a class="education-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer"><strong>${escape(label)}</strong><small>Original resource · opens in a new tab ↗</small></a>`;
  function matching({query = '', need = '', access = ''} = {}) {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return resources.filter(r => (!need || r.needs.includes(need)) && (!access || r.access.includes(access)) && words.every(word => JSON.stringify(r).toLocaleLowerCase().includes(word)));
  }
  function cards(items) {
    return items.map(r => `<details class="education-card"><summary>${escape(r.name)}</summary><div class="education-body"><p>${escape(r.intro)}</p><p><strong>Explore:</strong> ${escape(r.needs.join(' · '))}</p><p><strong>Access options:</strong> ${escape(r.access.join(' · '))}. Support varies by activity and device.</p>${r.sections.map(([title,body])=>`<h3>${escape(title)}</h3><p>${escape(body)}</p>`).join('')}<div class="education-links">${link(`Visit ${r.name}`,r.url)}${(r.links||[]).map(([label,url])=>link(label,url)).join('')}</div></div></details>`).join('');
  }
  window.MTMSensoryPlay = {
    matching,
    render() {
      return `<section class="hero"><h1>🌈 Free Sensory &amp; Inclusive Play</h1><p>Find more ways to play, explore, communicate, and participate.</p></section><button class="btn secondary" data-go="sensory" type="button">← Back to Sensory Support</button>
      <div class="banner"><strong>Follow your child’s response.</strong> An activity that is calming for one child may be stimulating or uncomfortable for another. Preview it, adjust sound, movement, brightness, or intensity where possible, and pause or stop when needed.</div>
      <section class="card"><h2>Find the right activity</h2><p>Choose an interest or access method, or search for controls such as sound off, music, reduced motion, no timer, spoken instructions, or reading. Results identify providers to explore; features differ between their games.</p><div class="form-grid"><div class="field"><label for="playSearch">Search activities and sensory options</label><input id="playSearch" type="search" placeholder="Ripples, matching, sound, printables…"></div><div class="field"><label for="playNeed">What would your child like to explore?</label><select id="playNeed"><option value="">All interests</option>${options('needs')}</select></div><div class="field"><label for="playAccess">How will your child access it?</label><select id="playAccess"><option value="">All access options</option>${options('access')}</select></div></div><button class="btn secondary" id="resetPlayFilters" type="button">Clear filters</button><p id="playCount" role="status" aria-live="polite">5 resource collections</p></section>
      <div id="playResults">${cards(resources)}</div>
      <details class="education-card"><summary>Not sure where to start?</summary><div class="education-body"><ul><li><strong>Sensory input or visual exploration:</strong> Sensory Shock, LightGames, Maggie Games, or Gentle Games.</li><li><strong>Eye gaze:</strong> LightGames or Adaptatech.</li><li><strong>Switch access:</strong> Maggie Games or Adaptatech.</li><li><strong>Sounds and music:</strong> LightGames, Adaptatech, or Gentle Games.</li><li><strong>Low-pressure play:</strong> Maggie Games, Gentle Games, or LightGames Relax activities.</li><li><strong>Cause &amp; effect:</strong> Maggie Games First Press, LightGames, or Sensory Shock.</li><li><strong>Matching and sorting:</strong> Maggie Games or Gentle Games.</li><li><strong>Nonspeaking communication:</strong> Explore Maggie Games, including Feelings Check-In; voice can be turned off to leave space for AAC.</li><li><strong>Screen-free play:</strong> Maggie Games printable matching activities.</li></ul></div></details>
      <section class="card"><h2>More ways to participate</h2><p>Watching counts. Repeating a favorite action counts. Quiet play, lights and sounds, switches, eye gaze, AAC, touch, and other forms of access can all have a place. The goal is to make more ways to play available, without expecting every child to play the same way.</p><p class="hint">Links open the original creators’ websites. MTM does not copy or host their games. Availability and access features can change; check the selected activity.</p></section>`;
    },
    bind(root) {
      const query = root.querySelector('#playSearch'), need = root.querySelector('#playNeed'), access = root.querySelector('#playAccess');
      const draw = () => {
        const items = matching({query:query.value, need:need.value, access:access.value});
        root.querySelector('#playCount').textContent = `${items.length} resource ${items.length === 1 ? 'collection' : 'collections'}`;
        root.querySelector('#playResults').innerHTML = items.length ? cards(items) : '<div class="empty card"><p>No collections match these filters. Try another term or clear the filters.</p></div>';
      };
      query.addEventListener('input',draw); need.addEventListener('change',draw); access.addEventListener('change',draw);
      root.querySelector('#resetPlayFilters').onclick = () => { query.value=''; need.value=''; access.value=''; draw(); query.focus(); };
    }
  };
})();
