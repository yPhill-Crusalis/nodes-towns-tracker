const fs = require("fs");
const path = require("path");

// ------------ Evaluation ------------

// Helper function: Get filenames
function fetchPaths() {
  const repoRoot = path.resolve(__dirname); // repo root
  return fs.readdirSync(repoRoot, { withFileTypes: true })
   .filter(entry => entry.isFile() && entry.name.startsWith("nodes-towns"))
   .map(entry => entry.name);
}

// Helper function: Get all backups
function fetchAndMergeFiles() {
  const paths = fetchPaths();
  return paths.map(fileName => {
    const filePath = path.resolve(__dirname, fileName);
    const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return [fileName, fileData];
  });
}

// Helper function: Convert filename to Unix timestamp
function filenameToUnixtimestamp(filename) {
  // Extract the date and time part from the filename
  const datePart = filename.match(/\d{8}_\d{6}/)[0]; // "20250726_224156"

  // Parse into components
  const year = datePart.slice(0, 4);    // "2025"
  const month = datePart.slice(4, 6);   // "07"
  const day = datePart.slice(6, 8);     // "26"
  const hour = datePart.slice(9, 11);   // "22"
  const minute = datePart.slice(11, 13);// "41"
  const second = datePart.slice(13, 15);// "56"

  // Create a JS Date object (months are 0-based index in JavaScript Date)
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  // Get Unix timestamp (seconds since epoch)
  const unixTimestamp = Math.floor(date.getTime() / 1000);

  return unixTimestamp
}

// Helper function: Unix timestamp to UTC String
function unixToUTC(unixMiliseconds) {
  // Convert from seconds to milliseconds
  const date = new Date(parseInt(unixMiliseconds));

  // Return UTC string
  return date.toUTCString();
}

// Helper function: Convert ms in s
function msINs(time) {
  return Math.floor(time/1000)
}

// 2 Helper functions: Evaluate pairs of files
function firstFiles(files, callback) {
  const [pathA, fileA] = files[0]
  const [pathB, fileB] = files[1]
  return callback(fileA, fileB, pathA, pathB)
}

function allPairsOfFiles(files, callback) {
  const results = []
  for (let i = 0; i < files.length - 1; i++) {
    const [pathA, fileA] = files[i]
    const [pathB, fileB] = files[i+1]
    results.push(callback(fileA, fileB, pathA, pathB))
  }
  return results
}

function getPlayerLastOnline(id) {
  const files = fetchAndMergeFiles()
  const result = []

  const evaluate = (fileA, fileB, pathA, pathB) => {
    let lastOnlineA = null
    let lastOnlineB = null
    const timeA = filenameToUnixtimestamp(pathA)
    const timeB = pathB === "now" ? "now" : filenameToUnixtimestamp(pathB)

    if (id in fileA.residents) lastOnlineA = fileA.residents[id].lastOnline
    if (id in fileB.residents) lastOnlineB = fileB.residents[id].lastOnline

    const timeString = timeB === "now"
      ? `data from now`
      : `data from <t:${timeB}>`

    if (lastOnlineA == null && lastOnlineB == null) {
      return `🚫 User has not yet joined the server. (${timeString})`
    } else if (lastOnlineA == null && lastOnlineB != null) {
      return `🚪 User has joined the server for the first time and was last online at at <t:${msINs(lastOnlineB)}>. (${timeString})`
    } else if (lastOnlineA - lastOnlineB != 0) {
      return `🟢 User was online at <t:${msINs(lastOnlineB)}>. (${timeString})`
    } else {
      return `🟡 User was NOT online. (${timeString})`
    }
  }

  result.push(...allPairsOfFiles(files, evaluate))

  return result
}

function getPlayerLastJoinTown(id) {
  const files = fetchAndMergeFiles()
  const result = []

  const evaluateFirst = (fileA, fileB, pathA, pathB) => {
    let startingTown = 0
    let startingTownJoinTimeA = 0
    const timeA = filenameToUnixtimestamp(pathA)
    if (id in fileA.residents) startingTown = fileA.residents[id].town
    if (id in fileA.residents) startingTownJoinTimeA = fileA.residents[id].townJoinTime

    const timeString = `data from <t:${timeA}>`

    if (startingTown == 0) {
      return `🚫 User has not yet joined the server. (${timeString})`
    } else if (startingTown == null) {
      return `🗺️ User had no town. (${timeString})`
    } else {
      return `🏠 User joined town \`${startingTown}\` at <t:${msINs(startingTownJoinTimeA)}>. (${timeString})`
    }
  }

  const evaluatePair = (fileA, fileB, pathA, pathB) => {
    let townA = 0
    let townB = 0
    let townJoinTimeA = 0
    let townJoinTimeB = 0
    const timeA = filenameToUnixtimestamp(pathA)
    const timeB = pathB === "now" ? "now" : filenameToUnixtimestamp(pathB)

    if (id in fileA.residents) townA = fileA.residents[id].town
    if (id in fileB.residents) townB = fileB.residents[id].town
    
    if (id in fileA.residents) townJoinTimeA = fileA.residents[id].townJoinTime
    if (id in fileB.residents) townJoinTimeB = fileB.residents[id].townJoinTime

    const timeString = timeB === "now"
      ? `data from now`
      : `data from <t:${timeB}>`

    if (townJoinTimeA == townJoinTimeB) {
      return `⬇ (${timeString})`
    } else if (townA == townB) {
      return `🔄 User rejoined town \`${townB}\` at <t:${msINs(townJoinTimeB)}>. (${timeString})`
    } else{
      return `🏠 User joined town \`${townB}\` at <t:${msINs(townJoinTimeB)}>. (${timeString})`
    }
  }

  result.push(firstFiles(files, evaluateFirst))
  result.push(...allPairsOfFiles(files, evaluatePair))

  return result
}

// ------------ Main ------------

function saveResults(id, data) {
  const filePath = path.join(__dirname, "results", `${id}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function processID(id) {
  const data = {lastonline: getPlayerLastOnline(id), lasttown: getPlayerLastJoinTown(id)};
  saveResults(id, data);
}

function getLatestUserIDs() {
  const files = fetchAndMergeFiles()
  const [path, file] = files[files.length - 1]
  const ids = Object.keys(file.residents)
  return ids
}

getLatestUserIDs().forEach(processID);
