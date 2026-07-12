import type { FeedConfig } from "./types.js";

// Hardcoded feed set for day one. A sourceFeeds config table can come later.
export const FEEDS: FeedConfig[] = [
  {
    url: "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
    beat: "top",
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en",
    beat: "nation",
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en",
    beat: "business",
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en",
    beat: "world",
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en",
    beat: "sports",
  },
  {
    url: "https://news.google.com/rss/search?q=india%20when:2h&hl=en-IN&gl=IN&ceid=IN:en",
    beat: "search",
  },
];
