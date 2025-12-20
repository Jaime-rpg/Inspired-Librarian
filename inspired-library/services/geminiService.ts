import { GoogleGenAI, Type } from "@google/genai";
import { RAW_BOOK_DATABASE_TSV } from "../constants.ts";
import { Book, Difficulty, ReadingCategory } from "../types.ts";

const CACHE_KEY_PREFIX = 'cec_recs_v13_'; 
const HISTORY_KEY_PREFIX = 'cec_history_v1_';

export interface RawBook {
  id: string;
  code: string;
  title: string;
  series: string;
  author: string;
  lexile: string;
  bl: number;
  genre: string;
  theme: string;
  summary: string;
}

const parseBookData = (tsvData: string): RawBook[] => {
  const lines = tsvData.trim().split('\n');
  const books: RawBook[] = [];
  
  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 8) continue;
    
    const bl = parseFloat(cols[7]);
    if (isNaN(bl)) continue;

    books.push({
      id: cols[0],
      code: cols[2], 
      title: cols[3],
      series: cols[4],
      author: cols[5],
      lexile: cols[6],
      bl: bl,
      genre: cols[8],
      theme: cols[10],
      summary: cols[12] || ""
    });
  }
  return books;
};

export const ALL_BOOKS_DATABASE = parseBookData(RAW_BOOK_DATABASE_TSV);

const getBlRange = (grade: string): { min: number, max: number } => {
  const g = grade.toLowerCase();
  if (g.includes("1st")) return { min: 0.1, max: 1.5 }; 
  if (g.includes("2nd")) return { min: 1.0, max: 2.8 }; 
  if (g.includes("3rd")) return { min: 2.0, max: 3.8 }; 
  if (g.includes("4th")) return { min: 3.0, max: 4.8 }; 
  if (g.includes("5th")) return { min: 3.5, max: 6.0 }; 
  if (g.includes("6th")) return { min: 3.5, max: 8.0 };
  return { min: 0.1, max: 13.0 };
};

const getRelevancyScore = (book: RawBook, month: string, theme: string, query?: string): number => {
  let score = 0;
  const m = month.toLowerCase();
  const t = theme.toLowerCase();
  const text = (book.title + " " + book.author + " " + book.theme + " " + book.summary + " " + book.genre).toLowerCase();

  if (query && query.trim().length > 0) {
    const q = query.toLowerCase().trim();
    if (book.title.toLowerCase().includes(q)) score += 50;
    if (book.author.toLowerCase().includes(q)) score += 40;
    if (text.includes(q)) score += 20;
    if (score < 20) return -100;
  }

  if (t !== "all themes") {
    if (t.includes("animals") && (text.includes("animal") || text.includes("dog") || text.includes("cat") || text.includes("zoo") || text.includes("bird") || text.includes("nature"))) score += 30;
    if (t.includes("fantasy") && (text.includes("magic") || text.includes("fantasy") || text.includes("wizard") || text.includes("dragon") || text.includes("fairy"))) score += 30;
    if (t.includes("history") && (text.includes("history") || text.includes("past") || text.includes("biography") || text.includes("president") || text.includes("war"))) score += 30;
    if (t.includes("science") && (text.includes("science") || text.includes("space") || text.includes("planet") || text.includes("math") || text.includes("discover"))) score += 30;
    if (t.includes("friendship") && (text.includes("friend") || text.includes("feeling") || text.includes("social") || text.includes("family"))) score += 30;
    if (t.includes("mystery") && (text.includes("mystery") || text.includes("detective") || text.includes("solve") || text.includes("adventure") || text.includes("secret"))) score += 30;
    if (t.includes("sports") && (text.includes("sport") || text.includes("soccer") || text.includes("baseball") || text.includes("game") || text.includes("hobby"))) score += 30;
    if (t.includes("holidays") && (text.includes("holiday") || text.includes("christmas") || text.includes("thanksgiving") || text.includes("season"))) score += 30;
    if (t.includes("humor") && (text.includes("humor") || text.includes("funny") || text.includes("silly") || text.includes("clown") || text.includes("joke"))) score += 30;
  }

  if (m === "january" && (text.includes("snow") || text.includes("winter"))) score += 5;
  if (m === "february" && (text.includes("valentine") || text.includes("heart"))) score += 5;
  if (m === "october" && (text.includes("halloween") || text.includes("pumpkin"))) score += 5;
  if (m === "december" && (text.includes("christmas") || text.includes("holiday"))) score += 5;

  return score;
};

export const generateBookRecommendations = async (
  grade: string,
  month: string,
  theme: string,
  limit: number = 10,
  query?: string
) => {
  const cacheKey = `${CACHE_KEY_PREFIX}${grade}_${theme}_${month}_count_${limit}_search_${query || 'none'}`; 
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }

  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const { min, max } = getBlRange(grade);
  let candidates = ALL_BOOKS_DATABASE;
  
  if (!query) {
     candidates = candidates.filter(b => b.bl >= (min - 0.3) && b.bl <= (max + 0.3));
  }

  const scoredCandidates = candidates
    .map(b => ({ ...b, score: getRelevancyScore(b, month, theme, query) + Math.random() }))
    .filter(b => b.score > -5); 

  scoredCandidates.sort((a, b) => b.score - a.score);
  const topCandidates = scoredCandidates.slice(0, Math.max(40, limit * 2));

  if (query && topCandidates.length === 0) return { books: [] };

  const bookSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      code: { type: Type.STRING },
      title: { type: Type.STRING },
      series: { type: Type.STRING },
      author: { type: Type.STRING },
      lexile: { type: Type.STRING },
      bl: { type: Type.STRING },
      genre1: { type: Type.STRING },
      theme: { type: Type.STRING },
      summary: { type: Type.STRING },
      videoUrl: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: ["Beginner", "Intermediate", "Advanced"] },
      category: { type: Type.STRING, enum: ["Must Read", "Recommended Reading"] },
      coverUrl: { type: Type.STRING }
    },
    required: ["id", "code", "title", "author", "difficulty", "category", "summary", "lexile", "bl", "videoUrl"],
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      books: { type: Type.ARRAY, items: bookSchema },
    },
    required: ["books"],
  };

  // Enforce 50/50 split with 5 book minimum for each
  const mustReadCount = Math.max(5, Math.floor(limit / 2));
  const recommendedCount = limit - mustReadCount;

  const prompt = `
    Task: Curate EXACTLY ${limit} books for an elementary reading deck.
    Context: Grade ${grade}, Theme: ${theme}, Month: ${month}.
    Search Query: ${query || "N/A"}
    
    Source Material: ${JSON.stringify(topCandidates)}
    
    Instructions:
    1. Select EXACTLY ${limit} books total.
    2. THE CATEGORY SPLIT MUST BE AS FOLLOWS:
       - Assign EXACTLY ${mustReadCount} books to "Must Read".
       - Assign EXACTLY ${recommendedCount} books to "Recommended Reading".
       - Ensure at least 5 books are in each category.
    3. Categorize each book based on BL: "Beginner" (BL < 3.0), "Intermediate" (BL 3.0-5.0), or "Advanced" (BL > 5.0).
    4. Provide valid YouTube "Read Aloud" videoUrl for each title.
    5. Maintain original metadata (id, code, title, author).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: responseSchema, temperature: 0.1 },
    });
    const result = JSON.parse(response.text || "{ \"books\": [] }");
    if (result.books && result.books.length > 0) localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const verifyBookCoverMatch = async (base64Image: string, title: string, author: string): Promise<{ isMatch: boolean; reason: string }> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = base64Image.split(',')[1] || base64Image;
  const prompt = `Verify if this is the cover for "${title}" by "${author}".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Data } }, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { isMatch: { type: Type.BOOLEAN }, reason: { type: Type.STRING } },
          required: ["isMatch", "reason"]
        }
      }
    });
    return JSON.parse(response.text || '{"isMatch": false, "reason": "No response"}');
  } catch (error) {
    return { isMatch: false, reason: "Verification service failed." };
  }
};