import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const processRefs = (
  input: string
): { citation: string; link: string }[] =>
  input
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?=\[\d+\.\s+\([^)]+\)\s+)/)
    .map((ref) => ref.trim())
    .filter((ref) => ref.length > 0)
    .map((reference) => {
      let processed = reference.replace(/^\[\d+\.\s+\([^)]+\)\s+/, "");

      const linkMatch = processed.match(/\]\((https?:\/\/[^\s)]+)/);
      const link = linkMatch ? linkMatch[1] : "";

      // Remove the "URL: http://dx.doi.org/..." part
      processed = processed.replace(
        /URL:\s*http:\/\/dx\.doi\.org\/[^,]+,\s*/,
        ""
      );

      processed = processed.replace(/\]\(.*\)$/, "");

      return {
        citation: processed.trim(),
        link: link,
      };
    });
