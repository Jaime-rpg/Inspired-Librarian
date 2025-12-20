
export enum GradeLevel {
  First = "1st Grade",
  Second = "2nd Grade",
  Third = "3rd Grade",
  Fourth = "4th Grade",
  Fifth = "5th Grade",
  Sixth = "6th Grade"
}

export enum Month {
  January = "January",
  February = "February",
  March = "March",
  April = "April",
  May = "May",
  June = "June",
  July = "July",
  August = "August",
  September = "September",
  October = "October",
  November = "November",
  December = "December"
}

export enum Difficulty {
  Beginner = "Beginner",
  Intermediate = "Intermediate",
  Advanced = "Advanced"
}

export enum ReadingCategory {
  MustRead = "Must Read",
  Recommended = "Recommended Reading"
}

export interface Book {
  id: string; // "Book number from database"
  code: string; // "Alphanumeric code (M0001, S0001)"
  title: string;
  series: string;
  author: string;
  lexile: string;
  bl: string; // Book Level
  genre1: string;
  genre2: string;
  theme: string;
  summary: string;
  difficulty: Difficulty;
  category: ReadingCategory;
  coverUrl: string;
  videoUrl?: string; // Link to YouTube story
}

export interface RecommendationResponse {
  year: number;
  grade: string;
  month: string;
  books: Book[];
}
