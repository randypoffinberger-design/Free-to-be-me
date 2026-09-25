"use strict";
/* A module is navigation metadata, never ownership, access control or stored data.
   IDs are stable across presentations and future per-profile layout records. */
window.MTMModules = (() => {
  const definitions = [
  {
    "id": "caregiverMeetups",
    "title": "Social Meetups",
    "icon": "🤝",
    "description": "Find or create inclusive playdates, family gatherings, parent meetups, and sensory-friendly outings.",
    "destination": {
      "route": "community"
    }
  },
  {
    "id": "caregiverToys",
    "title": "Free Toy Exchange",
    "icon": "🧸",
    "description": "Offer toys your family no longer needs or find free toys offered by parents nearby.",
    "destination": {
      "route": "toys"
    }
  },
  {
    "id": "caregiverRecommended",
    "title": "Recommended",
    "icon": "⭐",
    "description": "Find parent-recommended doctors, dentists, therapists, restaurants, schools, activities, and other local places.",
    "destination": {
      "route": "recommendations"
    }
  },
  {
    "id": "caregiverRecommendedBabysitters",
    "title": "Find a babysitter",
    "icon": "🧑‍🍼",
    "description": "Find profiles created by babysitters, view approved parent nominations, or recommend a babysitter you trust.",
    "destination": {
      "route": "babysitters"
    }
  },
  {
    "id": "caregiverBabysitter",
    "title": "Babysitter care sheet",
    "icon": "🧑‍🍼",
    "description": "Pull saved care details into editable text that can be shared without an app.",
    "destination": {
      "action": "caregiverBabysitter"
    }
  },
  {
    "id": "caregiverEmergencyContacts",
    "title": "Emergency contacts",
    "icon": "☎️",
    "description": "Save multiple contacts per child for redundancy and care-sheet sharing.",
    "destination": {
      "action": "caregiverEmergencyContacts"
    }
  },
  {
    "id": "caregiverEncouragement",
    "title": "Encouragement",
    "icon": "💬",
    "description": "Weekly messages and strength-focused reminders.",
    "destination": {
      "action": "caregiverEncouragement"
    }
  },
  {
    "id": "caregiverTerms",
    "title": "Common terms",
    "icon": "📖",
    "description": "Plain-language explanations of autism and sensory terminology.",
    "destination": {
      "action": "caregiverTerms"
    }
  },
  {
    "id": "caregiverSigns",
    "title": "Signs of autism",
    "icon": "🧭",
    "description": "Social communication, repetition, routines, sensory differences, and when to ask for an evaluation.",
    "destination": {
      "action": "caregiverSigns"
    }
  },
  {
    "id": "caregiverMyths",
    "title": "ASD myths and misconceptions",
    "icon": "🧠",
    "description": "Clear explanations of common assumptions about autism, communication, empathy, stimming, and support.",
    "destination": {
      "route": "myths"
    }
  },
  {
    "id": "caregiverAggression",
    "title": "Aggressive behaviors",
    "icon": "🫶",
    "description": "Why they may happen, what they can look like, safer responses, and what to avoid.",
    "destination": {
      "action": "caregiverAggression"
    }
  },
  {
    "id": "caregiverRegulationGuides",
    "title": "Regulation & confidence",
    "icon": "🌱",
    "description": "Visual guides for connection, emotional regulation, confidence, and supportive caregiving.",
    "destination": {
      "action": "caregiverRegulationGuides"
    }
  },
  {
    "id": "caregiverEducation",
    "title": "Educational options",
    "icon": "🎓",
    "description": "Homeschooling, school choices, IEPs, 504 plans, resources, and letter templates.",
    "destination": {
      "route": "education"
    }
  },
  {
    "id": "caregiverAssessment",
    "title": "Autism assessment information",
    "icon": "🧭",
    "description": "When assessment can begin, how it works, what to bring, and what to expect.",
    "destination": {
      "route": "assessment"
    }
  },
  {
    "id": "caregiverBenefits",
    "title": "Benefits & financial support",
    "icon": "🤲",
    "description": "Paid caregiving, SSI and SSDI, Medicaid, tax help, respite, and overlooked resources.",
    "destination": {
      "route": "benefits"
    }
  },
  {
    "id": "caregiverSafety",
    "title": "ASD safety",
    "icon": "🛟",
    "description": "Wandering, trackers, identification, car seats, water, home, school, and emergency planning.",
    "destination": {
      "route": "safety"
    }
  },
  {
    "id": "caregiverTherapy",
    "title": "Therapy & support",
    "icon": "🧩",
    "description": "ABA, speech, OT, AAC, other therapies, wait lists, benefits, concerns, and what to expect.",
    "destination": {
      "route": "therapy"
    }
  },
  {
    "id": "caregiverCalendar",
    "title": "Calendar",
    "icon": "📅",
    "description": "",
    "destination": {
      "action": "caregiverCalendar"
    }
  },
  {
    "id": "caregiverTodos",
    "title": "To-do list",
    "icon": "✅",
    "description": "",
    "destination": {
      "action": "caregiverTodos"
    }
  },
  {
    "id": "caregiverReflections",
    "title": "Caregiver Reflections",
    "icon": "📝",
    "description": "",
    "destination": {
      "action": "caregiverReflections"
    }
  },
  {
    "id": "growth",
    "title": "Growth Journey",
    "icon": "🌱",
    "description": "",
    "destination": {
      "route": "child"
    },
    "art": {
      "x": 957,
      "y": 157
    },
    "children": [
      "dailyCareProfile",
      "viewAchievements",
      "viewWords",
      "providerSummary",
      "myDay",
      "screenTime",
      "food"
    ]
  },
  {
    "id": "communication",
    "title": "Speech/Language Building",
    "icon": "💬",
    "description": "",
    "destination": {
      "route": "speech"
    },
    "art": {
      "x": 1132,
      "y": 157
    },
    "children": [
      "vocabulary",
      "speechGuide_asl",
      "speechGuide_signs",
      "speechGuide_useAsl",
      "speechGuide_aac",
      "speechGuide_flash",
      "speechGuide_apps",
      "speechGuide_oralTies",
      "speechGuide_communicationVisual",
      "speechGuide_products"
    ]
  },
  {
    "id": "sleep",
    "title": "Sleep Sanctuary",
    "icon": "🌙",
    "description": "",
    "destination": {
      "route": "sleep"
    },
    "art": {
      "x": 1307,
      "y": 157
    },
    "children": [
      "sleepWhy",
      "sleepExample",
      "sleepRoutine",
      "sleepEnvironment",
      "sleepFamilyRoutine",
      "sleepCompare",
      "sleepMagnesium",
      "sleepBeds",
      "sleepPreferences",
      "sleepProducts"
    ]
  },
  {
    "id": "sensory",
    "title": "Sensory Support",
    "icon": "🫧",
    "description": "",
    "destination": {
      "route": "sensory"
    },
    "art": {
      "x": 1482,
      "y": 157
    },
    "children": [
      "sensoryNeeds",
      "sensoryVisualGuides",
      "sensoryCheck",
      "spdGuide",
      "triggerGuide",
      "materialPreferences",
      "fabricGuide",
      "sensoryProducts",
      "sensoryPlay"
    ]
  },
  {
    "id": "learning",
    "title": "Skill Building",
    "icon": "📖",
    "description": "",
    "destination": {
      "route": "skills"
    },
    "art": {
      "x": 957,
      "y": 419
    },
    "children": [
      "lifeSkills",
      "potty",
      "pottyTips",
      "waitingTurnsGuide",
      "learningGuide",
      "strengthsStruggles",
      "diaperHelp",
      "imaginationLibrary",
      "skillProducts",
      "bookLibrary"
    ]
  },
  {
    "id": "medical",
    "title": "Health and Wellness",
    "icon": "🩺",
    "description": "",
    "destination": {
      "route": "health"
    },
    "art": {
      "x": 1132,
      "y": 419
    },
    "children": [
      "medicalLetter",
      "apptPrep",
      "providerReport",
      "apptNotes",
      "chiropracticArticles",
      "labGuide",
      "mthfrGuide",
      "gutGuide",
      "probioticGuide",
      "vitaminGuide",
      "placardGuide",
      "methylProductsGuide"
    ]
  },
  {
    "id": "caregiver",
    "title": "Caregiver Corner",
    "icon": "💛",
    "description": "",
    "destination": {
      "route": "caregiver"
    },
    "art": {
      "x": 1307,
      "y": 419
    },
    "children": [
      "caregiverMeetups",
      "caregiverToys",
      "caregiverRecommended",
      "caregiverRecommendedBabysitters",
      "caregiverBabysitter",
      "caregiverEmergencyContacts",
      "caregiverEncouragement",
      "caregiverTerms",
      "caregiverSigns",
      "caregiverMyths",
      "caregiverAggression",
      "caregiverRegulationGuides",
      "caregiverEducation",
      "caregiverAssessment",
      "caregiverBenefits",
      "caregiverSafety",
      "caregiverTherapy",
      "caregiverCalendar",
      "caregiverTodos",
      "caregiverReflections"
    ]
  },
  {
    "id": "community",
    "title": "ASD Friendly Fun",
    "icon": "🎡",
    "description": "",
    "destination": {
      "route": "fun"
    },
    "art": {
      "x": 1482,
      "y": 419
    },
    "children": [
      "funAccessPass",
      "funPlaces",
      "funSocial",
      "funExplore",
      "funCruising",
      "funFilms"
    ]
  },
  {
    "id": "village",
    "title": "The Village",
    "icon": "🏘️",
    "description": "",
    "destination": {
      "route": "village"
    }
  },
  {
    "id": "sleepWhy",
    "title": "Why can sleep be harder for autistic children?",
    "icon": "🧠",
    "description": "Understand overlapping sleep challenges.",
    "destination": {
      "route": "sleepWhy"
    }
  },
  {
    "id": "sleepExample",
    "title": "Example bedtime routine",
    "icon": "🕯️",
    "description": "Explore a predictable wind-down sequence.",
    "destination": {
      "route": "sleepExample"
    }
  },
  {
    "id": "sleepRoutine",
    "title": "Build your bedtime routine",
    "icon": "🧩",
    "description": "Create and save a routine for each child.",
    "destination": {
      "route": "sleepRoutine"
    }
  },
  {
    "id": "sleepEnvironment",
    "title": "Make the sleep environment work better",
    "icon": "🛏️",
    "description": "Adapt light, sound, clothing, and surroundings.",
    "destination": {
      "route": "sleepEnvironment"
    }
  },
  {
    "id": "sleepFamilyRoutine",
    "title": "Your family’s 45-minute routine, safely adapted",
    "icon": "🌙",
    "description": "Balance active play and lower stimulation.",
    "destination": {
      "route": "sleepFamilyRoutine"
    }
  },
  {
    "id": "sleepCompare",
    "title": "Magnesium vs. melatonin",
    "icon": "🧴",
    "description": "Read the existing guidance and safety information.",
    "destination": {
      "route": "sleepCompare"
    }
  },
  {
    "id": "sleepMagnesium",
    "title": "Magnesium: how it works, forms, and evidence",
    "icon": "🧴",
    "description": "Review forms, evidence, and questions for your clinician.",
    "destination": {
      "route": "sleepMagnesium"
    }
  },
  {
    "id": "sleepBeds",
    "title": "Medical and safety beds",
    "icon": "🏥",
    "description": "Review suitability, safety, and coverage questions.",
    "destination": {
      "route": "sleepBeds"
    }
  },
  {
    "id": "sleepPreferences",
    "title": "Discover your child’s preferences",
    "icon": "💜",
    "description": "Save sensory preferences for each child.",
    "destination": {
      "route": "sleepPreferences"
    }
  },
  {
    "id": "sleepProducts",
    "title": "Sleep products",
    "icon": "🛍️",
    "description": "Explore the existing product information and safety guidance.",
    "destination": {
      "route": "sleepProducts"
    }
  },
  {
    "id": "funAccessPass",
    "title": "Free lifetime federal recreation Access Pass",
    "icon": "🏞️",
    "description": "Learn about eligibility and application options.",
    "destination": {
      "route": "funAccessPass"
    }
  },
  {
    "id": "funPlaces",
    "title": "Find sensory-inclusive and autism-certified places",
    "icon": "📍",
    "description": "Explore directories and search local events.",
    "destination": {
      "route": "funPlaces"
    }
  },
  {
    "id": "funSocial",
    "title": "Socialization",
    "icon": "🤝",
    "description": "Explore social groups, programs, and meetups.",
    "destination": {
      "route": "funSocial"
    }
  },
  {
    "id": "funExplore",
    "title": "Autism-friendly places to explore",
    "icon": "🗺️",
    "description": "Browse the existing places and activity guides.",
    "destination": {
      "route": "funExplore"
    }
  },
  {
    "id": "funCruising",
    "title": "Autism-friendly cruising",
    "icon": "🚢",
    "description": "Review cruise supports and planning questions.",
    "destination": {
      "route": "funCruising"
    }
  },
  {
    "id": "funFilms",
    "title": "Sensory-friendly films",
    "icon": "🎬",
    "description": "Find the existing theater and showing links.",
    "destination": {
      "route": "funFilms"
    }
  },
  {
    "id": "dailyCareProfile",
    "title": "Daily Care & Safety",
    "icon": "🧭",
    "description": "Central instructions for caregivers, emergencies, school, respite, and babysitters.",
    "destination": {
      "action": "dailyCareProfile"
    },
    "shortcut": {
      "route": "child",
      "selector": "#dailyCareProfile"
    }
  },
  {
    "id": "viewAchievements",
    "title": "Wins",
    "icon": "✨",
    "description": "",
    "destination": {
      "action": "viewAchievements"
    },
    "shortcut": {
      "route": "child",
      "selector": "#viewAchievements"
    }
  },
  {
    "id": "viewWords",
    "title": "Words & phrases",
    "icon": "🗣️",
    "description": "",
    "destination": {
      "action": "viewWords"
    },
    "shortcut": {
      "route": "child",
      "selector": "#viewWords"
    }
  },
  {
    "id": "providerSummary",
    "title": "Provider summary",
    "icon": "📄",
    "description": "Share progress over time.",
    "destination": {
      "action": "providerSummary"
    },
    "shortcut": {
      "route": "child",
      "selector": "#providerSummary"
    }
  },
  {
    "id": "myDay",
    "title": "My Day",
    "icon": "🫧",
    "description": "Tap event bubbles, build a daily timeline, and watch for possible patterns over time.",
    "destination": {
      "route": "myDay"
    }
  },
  {
    "id": "screenTime",
    "title": "Screen time",
    "icon": "📱",
    "description": "Use a timer or manual entries and keep communication/AAC totals separate.",
    "destination": {
      "route": "screenTime"
    }
  },
  {
    "id": "food",
    "title": "Food diary",
    "icon": "🍽️",
    "description": "Track foods and meals by comfort level, then build gentle variety ideas.",
    "destination": {
      "route": "food"
    }
  },
  {
    "id": "vocabulary",
    "title": "Communication Tracker",
    "icon": "💬",
    "description": "Track words, sentences, letters, numbers, identification, speech, and ASL.",
    "destination": {
      "route": "vocabulary"
    }
  },
  {
    "id": "speechGuide_asl",
    "title": "ASL for ASD",
    "icon": "🤟",
    "description": "How signs can support communication without delaying speech.",
    "destination": {
      "action": "speechGuide_asl"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"asl\"]"
    }
  },
  {
    "id": "speechGuide_signs",
    "title": "ASL Quick Guide",
    "icon": "🖐️",
    "description": "Useful everyday signs with demonstration links and future clip slots.",
    "destination": {
      "action": "speechGuide_signs"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"signs\"]"
    }
  },
  {
    "id": "speechGuide_useAsl",
    "title": "How to Use ASL",
    "icon": "📘",
    "description": "Modeling, speech, repetition, processing time, and consistency.",
    "destination": {
      "action": "speechGuide_useAsl"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"useAsl\"]"
    }
  },
  {
    "id": "speechGuide_aac",
    "title": "AAC devices & apps",
    "icon": "🔊",
    "description": "Low-tech boards, dedicated devices, and communication apps.",
    "destination": {
      "action": "speechGuide_aac"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"aac\"]"
    }
  },
  {
    "id": "speechGuide_flash",
    "title": "Flash cards for ASD",
    "icon": "🃏",
    "description": "When visual cards help—and when real-life communication works better.",
    "destination": {
      "action": "speechGuide_flash"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"flash\"]"
    }
  },
  {
    "id": "speechGuide_apps",
    "title": "Speech-language apps",
    "icon": "📱",
    "description": "App categories and questions to ask before paying.",
    "destination": {
      "action": "speechGuide_apps"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"apps\"]"
    }
  },
  {
    "id": "speechGuide_oralTies",
    "title": "Oral ties explained",
    "icon": "👅",
    "description": "Tongue-tie, lip frenulums, feeding signs, evaluation, and treatment evidence.",
    "destination": {
      "action": "speechGuide_oralTies"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"oralTies\"]"
    }
  },
  {
    "id": "speechGuide_communicationVisual",
    "title": "Supporting communication growth",
    "icon": "🗨️",
    "description": "A visual guide to following the child’s lead, modeling language, pausing, and honoring every communication method.",
    "destination": {
      "action": "speechGuide_communicationVisual"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"communicationVisual\"]"
    }
  },
  {
    "id": "speechGuide_products",
    "title": "Communication products",
    "icon": "🛍️",
    "description": "Product guidance and caregiver-supplied shopping links together.",
    "destination": {
      "action": "speechGuide_products"
    },
    "shortcut": {
      "route": "speech",
      "selector": ".speech-guide[data-guide=\"products\"]"
    }
  },
  {
    "id": "medicalLetter",
    "title": "Medical necessity letter",
    "icon": "📄",
    "description": "Editable equipment and supply request template.",
    "destination": {
      "action": "medicalLetter"
    },
    "shortcut": {
      "route": "health",
      "selector": "#medicalLetter"
    }
  },
  {
    "id": "apptPrep",
    "title": "Prepare for an appointment",
    "icon": "📋",
    "description": "Build and save a doctor or therapy visit sheet.",
    "destination": {
      "action": "apptPrep"
    },
    "shortcut": {
      "route": "health",
      "selector": "#apptPrep"
    }
  },
  {
    "id": "providerReport",
    "title": "Generate provider report",
    "icon": "📊",
    "description": "Summarize profile, communication, Wins, life skills, food, and potty records.",
    "destination": {
      "action": "providerReport"
    },
    "shortcut": {
      "route": "health",
      "selector": "#providerReport"
    }
  },
  {
    "id": "apptNotes",
    "title": "After-appointment notes",
    "icon": "📝",
    "description": "Save instructions, decisions, referrals, and follow-up.",
    "destination": {
      "action": "apptNotes"
    },
    "shortcut": {
      "route": "health",
      "selector": "#apptNotes"
    }
  },
  {
    "id": "chiropracticArticles",
    "title": "Chiropractic article library",
    "icon": "🔗",
    "description": "Browse Paci Chiropractic's ADHD and autism article collection.",
    "destination": {
      "action": "chiropracticArticles"
    },
    "shortcut": {
      "route": "health",
      "selector": "#chiropracticArticles"
    }
  },
  {
    "id": "labGuide",
    "title": "Routine and symptom-guided labs",
    "icon": "🧪",
    "description": "What is routine, what is not, and questions to ask.",
    "destination": {
      "action": "labGuide"
    },
    "shortcut": {
      "route": "health",
      "selector": "#labGuide"
    }
  },
  {
    "id": "mthfrGuide",
    "title": "MTHFR explained",
    "icon": "🧬",
    "description": "Heterozygous, homozygous, compound variants, testing, folate, and homocysteine.",
    "destination": {
      "action": "mthfrGuide"
    },
    "shortcut": {
      "route": "health",
      "selector": "#mthfrGuide"
    }
  },
  {
    "id": "gutGuide",
    "title": "Gut health",
    "icon": "🫃",
    "description": "Constipation, reflux, diarrhea, feeding, pain, and when to seek help.",
    "destination": {
      "action": "gutGuide"
    },
    "shortcut": {
      "route": "health",
      "selector": "#gutGuide"
    }
  },
  {
    "id": "probioticGuide",
    "title": "Probiotics & prebiotics",
    "icon": "🦠",
    "description": "What evidence can and cannot tell us.",
    "destination": {
      "action": "probioticGuide"
    },
    "shortcut": {
      "route": "health",
      "selector": "#probioticGuide"
    }
  },
  {
    "id": "vitaminGuide",
    "title": "Vitamins & selective eating",
    "icon": "🍊",
    "description": "Deficiency risk, food-first support, testing, and supplement safety.",
    "destination": {
      "action": "vitaminGuide"
    },
    "shortcut": {
      "route": "health",
      "selector": "#vitaminGuide"
    }
  },
  {
    "id": "placardGuide",
    "title": "Disability parking placard",
    "icon": "♿",
    "description": "Why autism alone may not meet mobility-based state rules.",
    "destination": {
      "action": "placardGuide"
    },
    "shortcut": {
      "route": "health",
      "selector": "#placardGuide"
    }
  },
  {
    "id": "methylProductsGuide",
    "title": "MTHFR Methylated Supplement Comparison",
    "icon": "🥄",
    "description": "Powders, liquids, chewables, label checks, and pediatric safety.",
    "destination": {
      "action": "methylProductsGuide"
    },
    "shortcut": {
      "route": "health",
      "selector": "#methylProductsGuide"
    }
  },
  {
    "id": "sensoryNeeds",
    "title": "Eight sensory systems",
    "icon": "🧠",
    "description": "Seeking, avoiding, noticing late, and changing needs.",
    "destination": {
      "action": "sensoryNeeds"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#sensoryNeeds"
    }
  },
  {
    "id": "sensoryVisualGuides",
    "title": "Sensory visual guides",
    "icon": "🖼️",
    "description": "Sensory differences, regulation, grooming, hygiene, and safer sensory-input ideas.",
    "destination": {
      "action": "sensoryVisualGuides"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#sensoryVisualGuides"
    }
  },
  {
    "id": "sensoryCheck",
    "title": "Sensory pattern check-in",
    "icon": "🧭",
    "description": "A caregiver reflection—not a diagnostic assessment.",
    "destination": {
      "action": "sensoryCheck"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#sensoryCheck"
    }
  },
  {
    "id": "spdGuide",
    "title": "SPD and autism",
    "icon": "🧩",
    "description": "How sensory processing differences overlap with ASD.",
    "destination": {
      "action": "spdGuide"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#spdGuide"
    }
  },
  {
    "id": "triggerGuide",
    "title": "Common sensory triggers",
    "icon": "✂️",
    "description": "Water, clothing, haircuts, grass, nails, teeth, hair, and more.",
    "destination": {
      "action": "triggerGuide"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#triggerGuide"
    }
  },
  {
    "id": "materialPreferences",
    "title": "Clothing & bedding materials",
    "icon": "🧵",
    "description": "Save comfortable fabrics, difficult textures, seams, tags, fit, and bedding preferences.",
    "destination": {
      "action": "materialPreferences"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#materialPreferences"
    }
  },
  {
    "id": "fabricGuide",
    "title": "Why clothing and fabrics can feel different",
    "icon": "👕",
    "description": "Seams, tags, denim, socks, fit, temperature, and practical alternatives.",
    "destination": {
      "action": "fabricGuide"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#fabricGuide"
    }
  },
  {
    "id": "sensoryProducts",
    "title": "Sensory products, clothing & grants",
    "icon": "🛍️",
    "description": "Clothing options, equipment grants, and safer shopping questions.",
    "destination": {
      "action": "sensoryProducts"
    },
    "shortcut": {
      "route": "sensory",
      "selector": "#sensoryProducts"
    }
  },
  {
    "id": "lifeSkills",
    "title": "Life Skills Tracker",
    "icon": "🌟",
    "description": "Track new daily-living skills, practice, help, and independence.",
    "destination": {
      "route": "lifeSkills"
    }
  },
  {
    "id": "potty",
    "title": "Potty Training Tracker",
    "icon": "🚽",
    "description": "Track potty successes and accidents by day.",
    "destination": {
      "route": "potty"
    }
  },
  {
    "id": "pottyTips",
    "title": "Potty Training Tips & Tricks",
    "icon": "💡",
    "description": "Gentle, practical ideas to support learning and comfort.",
    "destination": {
      "route": "pottyTips"
    }
  },
  {
    "id": "waitingTurnsGuide",
    "title": "Waiting & taking turns",
    "icon": "⏳",
    "description": "A visual guide for building predictability, communication, and turn-taking support.",
    "destination": {
      "action": "waitingTurnsGuide"
    },
    "shortcut": {
      "route": "skills",
      "selector": "#waitingTurnsGuide"
    }
  },
  {
    "id": "learningGuide",
    "title": "How autistic children learn",
    "icon": "🧠",
    "description": "Strengths-first teaching ideas, prompting, repetition, and generalization.",
    "destination": {
      "action": "learningGuide"
    },
    "shortcut": {
      "route": "skills",
      "selector": "#learningGuide"
    }
  },
  {
    "id": "strengthsStruggles",
    "title": "Strengths & struggles",
    "icon": "🧭",
    "description": "Save a personal learning snapshot for each child.",
    "destination": {
      "action": "strengthsStruggles"
    },
    "shortcut": {
      "route": "skills",
      "selector": "#strengthsStruggles"
    }
  },
  {
    "id": "diaperHelp",
    "title": "Diapers & pull-ups through Medicaid",
    "icon": "🧷",
    "description": "Coverage questions, medical necessity, EPSDT, and supplier steps.",
    "destination": {
      "action": "diaperHelp"
    },
    "shortcut": {
      "route": "skills",
      "selector": "#diaperHelp"
    }
  },
  {
    "id": "imaginationLibrary",
    "title": "Imagination Library",
    "icon": "📚",
    "description": "Check for free monthly books for children from birth to age five.",
    "destination": {
      "action": "imaginationLibrary"
    },
    "shortcut": {
      "route": "skills",
      "selector": "#imaginationLibrary"
    }
  },
  {
    "id": "skillProducts",
    "title": "Skill-building products",
    "icon": "🛍️",
    "description": "Product categories and safer shopping questions.",
    "destination": {
      "action": "skillProducts"
    },
    "shortcut": {
      "route": "skills",
      "selector": "#skillProducts"
    }
  },
  {
    "id": "foodClaimsGuide",
    "title": "Food dyes, sugar, dairy & A2 milk",
    "icon": "🥛",
    "description": "Evidence, individual reactions, A2 dairy, and safer ways to investigate.",
    "destination": {
      "action": "foodClaimsGuide"
    },
    "shortcut": {
      "route": "food",
      "selector": "#foodClaimsGuide"
    }
  },
  {
    "id": "amazonSafetyProducts",
    "title": "Safety products",
    "icon": "🛒",
    "description": "Browse alarms, identification, monitoring, and other caregiver-supplied safety options.",
    "destination": {
      "action": "amazonSafetyProducts"
    },
    "shortcut": {
      "route": "safety",
      "selector": "#amazonSafetyProducts"
    }
  },
  {
    "id": "sensoryPlay",
    "title": "Free Sensory & Inclusive Play",
    "icon": "🎮",
    "description": "",
    "destination": {
      "route": "sensoryPlay"
    }
  },
  {
    "id": "bookLibrary",
    "title": "Build Your Child’s Library",
    "icon": "📖",
    "description": "",
    "destination": {
      "route": "bookLibrary"
    }
  }
];
  for (const item of definitions) {
    Object.freeze(item.destination);
    if (item.shortcut) Object.freeze(item.shortcut);
    if (item.art) Object.freeze(item.art);
    if (item.children) Object.freeze(item.children);
    Object.freeze(item);
  }
  const registry = new Map(definitions.map(item => [item.id, item]));
  // Defaults are immutable. Layouts choose up to eight home shortcuts separately.
  const sections = Object.freeze({home: Object.freeze(["growth", "communication", "sleep", "sensory", "learning", "medical", "caregiver", "community"]), caregiver: Object.freeze(["caregiverMeetups", "caregiverToys", "caregiverRecommended", "caregiverRecommendedBabysitters", "caregiverBabysitter", "caregiverEmergencyContacts", "caregiverEncouragement", "caregiverTerms", "caregiverSigns", "caregiverMyths", "caregiverAggression", "caregiverRegulationGuides", "caregiverEducation", "caregiverAssessment", "caregiverBenefits", "caregiverSafety", "caregiverTherapy", "caregiverCalendar", "caregiverTodos", "caregiverReflections"]), sleep: Object.freeze(["sleepWhy", "sleepExample", "sleepRoutine", "sleepEnvironment", "sleepFamilyRoutine", "sleepCompare", "sleepMagnesium", "sleepBeds", "sleepPreferences", "sleepProducts"]), fun: Object.freeze(["funAccessPass", "funPlaces", "funSocial", "funExplore", "funCruising", "funFilms"])});
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function get(id) {
    const item = registry.get(id);
    if (!item) throw new Error('Unknown module: ' + id);
    return item;
  }
  function render(id, {presentation = 'card', description, homeSlot = null} = {}) {
    const item = get(id);
    if (!['card', 'bubble'].includes(presentation)) throw new Error('Unknown module presentation');
    const detail = description ?? item.description;
    // Reuse the existing watercolour artwork as a sprite; no painted labels or
    // other navigation remains behind the independently laid-out button.
    const icon = item.art
      ? `<span class="module-icon module-art" aria-hidden="true" style="background-position:${item.art.x / 1492 * 100}% ${item.art.y / 761 * 100}%"></span>`
      : `<span class="module-icon module-emoji" aria-hidden="true">${escape(item.icon)}</span>`;
    const sourceSlot = sections.home.indexOf(id);
    const homeClass = homeSlot === null ? '' : ` home-slot home-slot-${homeSlot}${sourceSlot === homeSlot ? ' home-original-slot' : sourceSlot >= 0 ? ' home-art-slot' : ' home-custom-slot'}`;
    const tile = homeSlot !== null && sourceSlot >= 0 ? `<span class="home-module-tile home-source-${sourceSlot}" aria-hidden="true"></span>` : '';
    return `<button type="button" class="mtm-module module-${presentation}${presentation === 'card' ? ' card-button' : ''}${homeClass}" data-module="${escape(id)}" aria-label="Open ${escape(item.title)}">${tile}${icon}<strong>${escape(item.title)}</strong>${presentation === 'card' && detail ? `<small>${escape(detail)}</small>` : ''}</button>`;
  }
  function renderSection(section, {presentation = 'card', descriptions = {}} = {}) {
    if (!sections[section]) throw new Error('Unknown module section');
    return sections[section].map(id => render(id, {presentation, description: descriptions[id]})).join('');
  }
  // Rendering never opens a destination or reads/writes household data. The host
  // supplies the existing guarded navigator and existing feature handlers.
  function bind(root, {navigate, actions = {}, onError = error => alert(error.message)}) {
    root.querySelectorAll('[data-module]').forEach(button => {
      button.onclick = async () => {
        const item = get(button.dataset.module);
        try {
          if (item.destination.route) return await navigate(item.destination.route);
          const action = actions[item.destination.action];
          if (typeof action !== 'function') throw new Error('This module is unavailable here.');
          return await action();
        } catch (error) { onError(error); }
      };
    });
  }
  return Object.freeze({get, sections, ids: Object.freeze([...registry.keys()]), render, renderSection, bind});
})();
