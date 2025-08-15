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

const fetchedAndMergedFiles = fetchAndMergeFiles()

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

// Helper function: Check if 2 Arrays have the same elemnts
function haveSameElements(arr1, arr2) {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  if (set1.size !== set2.size) return false;

  for (let val of set1) {
    if (!set2.has(val)) return false;
  }
  return true;
}

// Helper function: Difference in 2 Arrays
function arrayDifference(arr1, arr2) {
  // Elements in arr1 but not in arr2
  const onlyInFirst = arr1.filter(item => !arr2.includes(item));

  // Elements in arr2 but not in arr1
  const onlyInSecond = arr2.filter(item => !arr1.includes(item));

  return [onlyInFirst, onlyInSecond];
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
  const files = fetchedAndMergedFiles
  const result = []

  const evaluate = (fileA, fileB, pathA, pathB) => {
    let lastOnlineA = null
    let lastOnlineB = null
    const timeA = filenameToUnixtimestamp(pathA)
    const timeB = filenameToUnixtimestamp(pathB)

    if (id in fileA.residents) lastOnlineA = fileA.residents[id].lastOnline
    if (id in fileB.residents) lastOnlineB = fileB.residents[id].lastOnline

    const timeString = `data from <t:${timeB}>`

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
  const files = fetchedAndMergedFiles
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
    const timeB = filenameToUnixtimestamp(pathB)

    if (id in fileA.residents) townA = fileA.residents[id].town
    if (id in fileB.residents) townB = fileB.residents[id].town
    
    if (id in fileA.residents) townJoinTimeA = fileA.residents[id].townJoinTime
    if (id in fileB.residents) townJoinTimeB = fileB.residents[id].townJoinTime

    const timeString = `data from <t:${timeB}>`

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

function getOfficersOverTime(townname) {
  const files = fetchedAndMergedFiles
  const result = []

  const evaluateFirst = (fileA, fileB, pathA, pathB) => {
    let officersA = null
    let officersB = null

    if (townname in fileA.towns) officersA = fileA.towns[townname].officers.map(id => fileA.residents[id].name)
    if (townname in fileB.towns) officersB = fileB.towns[townname].officers.map(id => fileB.residents[id].name)

    const timeA = filenameToUnixtimestamp(pathA)
    const timeB = filenameToUnixtimestamp(pathB)

    const timeString = `<t:${timeA}>:`
    result.push(timeString)

    if (officersA == null) {
      result.push(`🚫 Town has not yet been founded.`)
    } else {
      officersA.forEach(name => {result.push(`🟡 User ${name} was an Officer.`)})
    }
  }

  const evaluatePair = (fileA, fileB, pathA, pathB) => {
    let officersA = null
    let officersB = null

    if (townname in fileA.towns) officersA = fileA.towns[townname].officers.map(id => fileA.residents[id].name)
    if (townname in fileB.towns) officersB = fileB.towns[townname].officers.map(id => fileB.residents[id].name)

    const timeA = filenameToUnixtimestamp(pathA)
    const timeB = filenameToUnixtimestamp(pathB)

    const timeString = `<t:${timeB}>:`

    if (haveSameElements(officersA, officersB)) {
      // Do nothing, because nothing changed
    } else {
      result.push(timeString)
      if (officersA == null) {
        result.push("🏠 Town founded.")
        officersB.forEach(name => {result.push(`🟢 User ${name} became an Officer.`)})
      } else if (officersB == null) {
        result.push("🏚️ Town destroyed.")
      } else {
        [left, joined] = arrayDifference(officersA, officersB)
        left.forEach(name => {result.push(`🔴 User ${name} became an Officer.`)})
        joined.forEach(name => {result.push(`🟢 User ${name} became an Officer.`)})
      }
    }
  }

  firstFiles(files, evaluateFirst)
  allPairsOfFiles(files, evaluatePair)

  return result
}

// ------------ Main ------------

function saveResults(id, data) {
  const filePath = path.join(__dirname, "results", `${id}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function processID(id) {
  console.log(id)
  const data = {lastonline: getPlayerLastOnline(id), lasttown: getPlayerLastJoinTown(id)};
  saveResults(id, data);
}

function getLatestUserIDs() {
  const files = fetchedAndMergedFiles
  const [path, file] = files[files.length - 1]
  const ids = Object.keys(file.residents)
  return ids
}

getLatestUserIDs().forEach(processID);

function processTownname(townname) {
  console.log(townname)
  const data = {compareofficers: getOfficersOverTime(townname)};
  saveResults(townname, data);
}

function getLatestTownnames() {
  const files = fetchedAndMergedFiles
  const [path, file] = files[files.length - 1]
  const townnames = Object.keys(file.towns)
  return townnames
}

getLatestTownnames().forEach(processTownname);
