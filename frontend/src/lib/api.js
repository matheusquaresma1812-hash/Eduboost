import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API });

// Extract JSON block from a possibly-noisy LLM answer
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
}
