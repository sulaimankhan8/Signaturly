import fs from "fs";
import path from "path";

export const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const writeFile = (filePath, buffer) => {
  fs.writeFileSync(filePath, buffer);
};
