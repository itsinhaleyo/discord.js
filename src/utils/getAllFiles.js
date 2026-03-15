const fs = require('fs');
const path = require('path');

module.exports = (directory, foldersOnly = false) => {
  let fileNames = [];

  // Add this check to prevent the ENOENT error
  if (!fs.existsSync(directory)) {
    return []; 
  }

  const files = fs.readdirSync(directory, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(directory, file.name);

    if (foldersOnly) {
      if (file.isDirectory()) {
        fileNames.push(filePath);
      }
    } else {
      if (file.isFile()) {
        fileNames.push(filePath);
      }
    }
  }

  return fileNames;
};