// Small CSV helpers shared by the bulk-import features.
// Handles: UTF-8 / Windows-1252 files, `;` `,` or tab delimiters, quoted fields.

export const escapeCsvField = (value: string, delimiter: string): string =>
  /["\r\n]/.test(value) || value.includes(delimiter)
    ? `"${value.replace(/"/g, '""')}"`
    : value;

/** Build CSV text (starts with a BOM so Excel opens it as UTF-8). */
export const buildCsv = (rows: string[][], delimiter = ";"): string =>
  "\uFEFF" +
  rows.map((cols) => cols.map((c) => escapeCsvField(c, delimiter)).join(delimiter)).join("\r\n") +
  "\r\n";

/** Trigger a browser download of a text file. */
export const downloadTextFile = (filename: string, text: string): void => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Decode CSV bytes. Tries UTF-8 first; if the file is not valid UTF-8
 * (typical for CSV saved from Excel on Windows) falls back to Windows-1252.
 */
export const decodeCsvBuffer = (buffer: ArrayBuffer): string => {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^\uFEFF/, "");
};

/** Pick `;`, `,` or tab from the header line (whichever occurs most). */
export const detectDelimiter = (text: string): string => {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ";";
};

/** RFC 4180 style parser: quoted fields, escaped quotes (""), CRLF/LF. */
export const parseDelimitedText = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      inQuotes = true; // only a quote at the start of a field opens a quoted value
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
};

export const parseCsvText = (text: string): string[][] =>
  parseDelimitedText(text, detectDelimiter(text));
