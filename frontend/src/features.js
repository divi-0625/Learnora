// Describes the five features: their title, form fields and button text.
// The "name" of each field is exactly the field name the backend expects.
// usesLevel: show the Learning Level selector for this feature.
// voice: show a microphone button for this field.
// optional: the field may stay empty.
// supportsWeakTopics: show the "Focus on my weak topics" checkbox (logged-in students).
export const FEATURES = [
  {
    id: "ask",
    title: "Ask Question",
    icon: "💬",
    description: "Get clear answers to your academic questions.",
    buttonText: "Get Answer",
    usesLevel: true,
    fields: [
      {
        name: "question",
        label: "Your Question",
        type: "textarea",
        placeholder: "e.g., What is polymorphism in Java?",
        maxLength: 2000,
        voice: true,
      },
    ],
  },
  {
    id: "explain",
    title: "Explain Simply",
    icon: "💡",
    description: "Understand difficult concepts in simple words.",
    buttonText: "Explain It",
    usesLevel: true,
    fields: [
      {
        name: "topic",
        label: "Topic",
        type: "input",
        placeholder: "e.g., Recursion",
        maxLength: 200,
        voice: true,
      },
    ],
  },
  {
    id: "summarize",
    title: "Summarize",
    icon: "📝",
    description: "Turn lengthy study material into concise notes.",
    buttonText: "Summarize",
    usesLevel: false,
    fields: [
      {
        name: "text",
        label: "Study Material",
        type: "textarea",
        placeholder: "Paste the text you want summarized here...",
        maxLength: 15000,
      },
    ],
  },
  {
    id: "quiz",
    title: "Quiz",
    icon: "🎯",
    description: "Test your knowledge with practice questions.",
    buttonText: "Generate Quiz",
    usesLevel: true,
    fields: [
      {
        name: "topic",
        label: "Quiz Topic",
        type: "input",
        placeholder: "e.g., Operating Systems",
        maxLength: 200,
        voice: true,
      },
    ],
  },
  {
    id: "plan",
    title: "Study Plan",
    icon: "📅",
    description: "Create a realistic plan for your studies.",
    buttonText: "Create Plan",
    usesLevel: true,
    supportsWeakTopics: true,
    fields: [
      {
        name: "subject",
        label: "Subject / Topic",
        type: "input",
        placeholder: "e.g., Data Structures",
        maxLength: 200,
        voice: true,
      },
      {
        name: "studyTime",
        label: "Available Study Time",
        type: "input",
        placeholder: "e.g., 2 hours per day for 7 days",
        maxLength: 100,
      },
      {
        name: "goal",
        label: "Learning Goal",
        type: "input",
        placeholder: "e.g., Score 80% in the exam next week",
        maxLength: 200,
        optional: true,
      },
    ],
  },
];