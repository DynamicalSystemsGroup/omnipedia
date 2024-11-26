import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import { Section } from "./types";
import { processRefs } from "./utils";

const getDataFilePath = (
  type: "articles" | "results",
  filePath: string,
  extension: string
) => {
  // In development, use the local filesystem
  if (process.env.NODE_ENV === "development") {
    return path.join(
      process.cwd(),
      "public",
      "data",
      type,
      `${filePath}.${extension}`
    );
  }

  // In production (Vercel), use the public directory
  return path.join(
    process.cwd(),
    "public",
    "data",
    type,
    `${filePath}.${extension}`
  );
};

export async function getData(filePath: string): Promise<{ data: any | null }> {
  try {
    const fullPath = getDataFilePath("results", filePath, "json");
    const jsonData = await fs.readFile(fullPath, "utf8");
    return { data: JSON.parse(jsonData) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { data: null };
    }
    throw error;
  }
}

export async function parseWikicrow(
  filePath: string
): Promise<{ data: Section[] }> {
  const fullPath = getDataFilePath("articles", filePath, "md");
  const markdownText = await fs.readFile(fullPath, "utf-8");

  // Rest of the parseWikicrow function remains the same
  const tokens = marked.lexer(markdownText);
  const structuredData: Section[] = [];
  let currentHierarchy: string[] = [];
  let currentSection: Section | null = null;

  for (const token of tokens) {
    if (token.type === "heading") {
      if (currentSection) {
        structuredData.push(currentSection);
      }

      const level = token.depth;
      const title = token.text;

      currentHierarchy = [...currentHierarchy.slice(0, level - 1), title];
      currentSection = {
        title,
        content: "",
        hierarchy: currentHierarchy.join(" > "),
      };
    } else if (token.type === "paragraph" || token.type === "list") {
      if (currentSection) {
        currentSection.content += marked.parser([token]) + " ";
      }
    }
  }

  if (currentSection) {
    structuredData.push(currentSection);
  }

  return { data: structuredData };
}

export async function parseeWikicrow(
  filePath: string
): Promise<{ data: Section[] }> {
  const fullPath = getDataFilePath("articles", filePath, "md");
  const markdownText = await fs.readFile(fullPath, "utf-8");
  const lines = markdownText.split("\n");

  // Rest of the parseeWikicrow function remains the same
  const rootTitle = lines[0].replace(/^#+\s*/, "").trim();
  const sectionPattern = /^(#+)\s*(.*?)\s*$/;

  const structuredData: Section[] = [];
  let currentHierarchy = [rootTitle];
  let currentTitle = rootTitle;
  let currentContent = "";

  structuredData.push({
    title: currentTitle,
    content: "",
    hierarchy: currentHierarchy.join(" > "),
  });

  for (const line of lines.slice(1)) {
    const sectionMatch = line.match(sectionPattern);

    if (sectionMatch) {
      if (currentContent || currentHierarchy.length > 1) {
        structuredData.push({
          title: currentTitle,
          content: currentContent.trim(),
          hierarchy: currentHierarchy.join(" > "),
        });
      }

      const level = sectionMatch[1].length;
      currentTitle = sectionMatch[2].trim();
      currentHierarchy = [
        ...currentHierarchy.slice(0, level - 1),
        currentTitle,
      ];
      currentContent = "";
    } else {
      currentContent += line.trim() + " ";
    }
  }

  if (currentContent || currentHierarchy.length > 1) {
    structuredData.push({
      title: currentTitle,
      content: currentContent.trim(),
      hierarchy: currentHierarchy.join(" > "),
    });
  }

  return {
    data: [
      structuredData[0],
      ...structuredData
        .slice(1)
        .filter((section) => section.content || section.hierarchy !== rootTitle)
        .map((section) => {
          if (filePath.includes("wikicrow")) {
            if (section.title === "References" && section.content) {
              return {
                ...section,
                content: "",
                citations: processRefs(section.content),
              };
            }
          }

          if (section.title === "References" && section.content) {
            return {
              ...section,
              content: "",
              citations: parseWikipediaReferences(section.content),
            };
          }

          return section;
        }),
    ],
  };
}

export const parseWikipediaReferences = (
  input: string
): { citation: string; link: string }[] => {
  // ... existing implementation remains the same ...
  const pattern = /\[(\d+)\] ([^()]+) \((https?:\/\/[^\s]+)\)/g;
  const results: { id: string; text: string; url: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    const id = match[1];
    const text = match[2].trim();
    const url = match[3];

    results.push({ id, text, url });
  }

  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((reference) => {
      const linkMatch = reference.match(/\((https?:\/\/[^\s)]+)\)/);
      const link = linkMatch ? linkMatch[1] : "";
      const citation = reference.replace(/\s*\(https?:\/\/[^\s)]+\)\s*$/, "");
      return {
        citation: citation.trim(),
        link: link,
      };
    });
};