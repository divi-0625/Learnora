// Quote of the day: one stable quote for each calendar day.
// No random numbers are used, so refreshing the page never changes today's quote.
// Quotes are attributed only when the author is well known; otherwise the author is "Unknown".

export const QUOTES = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
  { text: "The important thing is not to stop questioning. Curiosity has its own reason for existing.", author: "Albert Einstein" },
  { text: "I have no special talent. I am only passionately curious.", author: "Albert Einstein" },
  { text: "Intelligence plus character—that is the goal of true education.", author: "Martin Luther King Jr." },
  { text: "A journey of a thousand miles begins with a single step.", author: "Laozi" },
  { text: "If I have seen further, it is by standing on the shoulders of giants.", author: "Isaac Newton" },
  { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", author: "Johann Wolfgang von Goethe" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "Learning is not attained by chance; it must be sought for with ardor and attended to with diligence.", author: "Abigail Adams" },
  { text: "A reader lives a thousand lives before he dies.", author: "George R. R. Martin" },
  { text: "He who learns but does not think is lost. He who thinks but does not learn is in great danger.", author: "Confucius" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "Small progress every day leads to big results.", author: "Unknown" },
  { text: "Learning is a treasure that will follow its owner everywhere.", author: "Chinese proverb" },
  { text: "Well begun is half done.", author: "Proverb" },
  { text: "Practice makes progress, not perfection.", author: "Unknown" },
  { text: "Every expert was once a beginner.", author: "Unknown" },
  { text: "Mistakes are proof that you are trying.", author: "Unknown" },
  { text: "Stay curious, ask questions and keep learning.", author: "Unknown" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
  { text: "Consistency beats intensity when you are learning something new.", author: "Unknown" },
  { text: "You understand an idea best when you can explain it in your own words.", author: "Unknown" },
  { text: "Revision turns what you have learned into what you remember.", author: "Unknown" },
  { text: "A small step today is better than a big plan tomorrow.", author: "Unknown" },
  { text: "Confidence comes from preparation.", author: "Unknown" },
  { text: "The best time to start was yesterday. The next best time is now.", author: "Unknown" },
  { text: "Slow and steady wins the race.", author: "Proverb" },
  { text: "Learn something new every day.", author: "Unknown" },
  { text: "Hard work compounds, one study session at a time.", author: "Unknown" },
  { text: "Questions are the beginning of understanding.", author: "Unknown" },
  { text: "Your effort today is the result you will see tomorrow.", author: "Unknown" },
  { text: "Rome was not built in a day.", author: "Proverb" },
  { text: "Doubt is a signal to look closer, not to give up.", author: "Unknown" },
  { text: "Every question you ask makes you a little wiser.", author: "Unknown" },
  { text: "Prepare well, and the exam becomes a chance to show what you know.", author: "Unknown" },
  { text: "Break big goals into small daily wins.", author: "Unknown" },
];

// "2026-10-17" for the student's own calendar day (their device's timezone)
export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Counts calendar days from a fixed start date. It uses only the year, month and day,
// so the clock time, daylight saving changes and timezones cannot shift it.
export function getDayNumber(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

// Same calendar day -> same quote. Next day -> the next quote in the list.
export function getQuoteForDate(date = new Date()) {
  const count = QUOTES.length;
  const index = ((getDayNumber(date) % count) + count) % count;
  return QUOTES[index];
}