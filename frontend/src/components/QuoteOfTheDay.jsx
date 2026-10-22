import { useEffect, useMemo, useState } from "react";
import { getDateKey, getQuoteForDate } from "../utils/quotes.js";

// Shows one quote per calendar day. The quote is chosen from the date (no random numbers),
// so a refresh never changes it, and it updates by itself when a new day starts.
function QuoteOfTheDay() {
  const [dateKey, setDateKey] = useState(() => getDateKey());

  // Check for a new day every minute, and when the student comes back to the tab
  useEffect(() => {
    function checkDate() {
      const now = getDateKey();
      setDateKey((previous) => (previous === now ? previous : now));
    }
    const timer = setInterval(checkDate, 60 * 1000);
    document.addEventListener("visibilitychange", checkDate);
    window.addEventListener("focus", checkDate);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", checkDate);
      window.removeEventListener("focus", checkDate);
    };
  }, []);

  const today = useMemo(() => new Date(), [dateKey]);
  const quote = useMemo(() => getQuoteForDate(today), [today]);
  const dateLabel = useMemo(
    () => today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
    [today]
  );

  return (
    <figure className="quote-panel" aria-labelledby="quote-label">
      <span className="quote-mark" aria-hidden="true">
        “
      </span>
      <p className="quote-label" id="quote-label" title={`Quote for ${dateLabel}`}>
        QUOTE OF THE DAY
      </p>
      <blockquote className="quote-text">{quote.text}</blockquote>
      <figcaption className="quote-author">— {quote.author}</figcaption>
    </figure>
  );
}

export default QuoteOfTheDay;