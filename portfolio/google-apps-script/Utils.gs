/**
 * Utils.gs
 * Utilities Module containing database access, JSON serialization, and date/time formatting.
 */

/**
 * Gets a sheet by its name from the active spreadsheet.
 * @param {string} sheetName Name of the sheet.
 * @return {Sheet} Spreadsheet sheet object.
 */
function getSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Active spreadsheet not found. Ensure script is container-bound to a Google Sheet.");
  }
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet '" + sheetName + "' not found in the spreadsheet database.");
  }
  return sheet;
}

/**
 * Helper to build a JSON text output response.
 * Note: setHeaders() is not supported on TextOutput in Google Apps Script.
 * CORS headers are handled automatically by Apps Script Web App redirects.
 * @param {Object} data Object to serialize.
 * @return {TextOutput} Text output ready to be returned from doGet/doPost.
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns a standardized JSON error response.
 * @param {string} message Error message explanation.
 * @return {TextOutput} JSON response with success: false.
 */
function errorResponse(message) {
  return jsonResponse({
    success: false,
    message: message
  });
}

/**
 * Returns a standardized JSON success response.
 * @param {string} message Success status message.
 * @param {Object} [extraData] Optional extra key-value pairs to include.
 * @return {TextOutput} JSON response with success: true.
 */
function successResponse(message, extraData) {
  var responseObj = {
    success: true,
    message: message
  };
  if (extraData && typeof extraData === 'object') {
    for (var key in extraData) {
      if (extraData.hasOwnProperty(key)) {
        responseObj[key] = extraData[key];
      }
    }
  }
  return jsonResponse(responseObj);
}

/**
 * Generates the next auto-incrementing ID for a sheet.
 * Assumes the ID is in column A (index 1).
 * @param {Sheet} sheet Sheet object.
 * @return {number} The next ID.
 */
function generateNextID(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  
  var lastId = sheet.getRange(lastRow, 1).getValue();
  if (isNaN(lastId) || lastId === "") {
    var maxId = 0;
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var id = Number(ids[i][0]);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    }
    return maxId + 1;
  }
  return Number(lastId) + 1;
}

/**
 * Formats a Date object as dd/MM/yyyy.
 * @param {Date} date Date object.
 * @return {string} Formatted date.
 */
function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

/**
 * Formats a Date object as hh:mm:ss a.
 * @param {Date} date Date object.
 * @return {string} Formatted time.
 */
function formatTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "hh:mm:ss a");
}

/**
 * Parses user agent to detect operating system, browser, and device type.
 * @param {string} userAgent Raw user agent string.
 * @return {Object} Parsed OS, browser, and device.
 */
function parseUserAgent(userAgent) {
  var ua = userAgent || "";
  var browser = "Unknown";
  var os = "Unknown";
  var device = "Desktop";

  // Browser detection
  if (ua.indexOf("Firefox") > -1) {
    browser = "Firefox";
  } else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) {
    browser = "Opera";
  } else if (ua.indexOf("Trident") > -1 || ua.indexOf("MSIE") > -1) {
    browser = "Internet Explorer";
  } else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) {
    browser = "Edge";
  } else if (ua.indexOf("Chrome") > -1) {
    browser = "Chrome";
  } else if (ua.indexOf("Safari") > -1) {
    browser = "Safari";
  }

  // OS detection
  if (ua.indexOf("Windows") > -1) {
    os = "Windows";
  } else if (ua.indexOf("Macintosh") > -1 || ua.indexOf("Mac OS X") > -1) {
    os = "macOS";
  } else if (ua.indexOf("Android") > -1) {
    os = "Android";
  } else if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1 || ua.indexOf("iPod") > -1) {
    os = "iOS";
  } else if (ua.indexOf("Linux") > -1) {
    os = "Linux";
  }

  // Device detection
  if (ua.indexOf("Mobi") > -1 || ua.indexOf("Android") > -1 || ua.indexOf("iPhone") > -1) {
    device = "Mobile";
  } else if (ua.indexOf("iPad") > -1 || ua.indexOf("Tablet") > -1) {
    device = "Tablet";
  }

  return {
    browser: browser,
    os: os,
    device: device
  };
}

/**
 * Parses custom formatted date and time strings or objects safely into a Date object.
 * @param {string|Date} dateVal Date value (either custom format dd/MM/yyyy string or Date object).
 * @param {string|Date} timeVal Time value (either custom format hh:mm:ss a string or Date object).
 * @return {Date|null} Reconstructed Date object or null if parsing fails.
 */
function parseCustomDateTime(dateVal, timeVal) {
  try {
    var dateObj = dateVal instanceof Date ? dateVal : null;
    var timeObj = timeVal instanceof Date ? timeVal : null;
    
    var day, month, year, hours, minutes, seconds;
    
    if (dateObj) {
      day = dateObj.getDate();
      month = dateObj.getMonth();
      year = dateObj.getFullYear();
    } else {
      var dateParts = dateVal.toString().split("/");
      if (dateParts.length < 3) return null;
      day = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10) - 1; // 0-indexed
      year = parseInt(dateParts[2], 10);
    }
    
    if (timeObj) {
      hours = timeObj.getHours();
      minutes = timeObj.getMinutes();
      seconds = timeObj.getSeconds();
    } else {
      var matches = timeVal.toString().match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
      if (!matches) {
        var parts = timeVal.toString().split(":");
        if (parts.length >= 3) {
          hours = parseInt(parts[0], 10);
          minutes = parseInt(parts[1], 10);
          seconds = parseInt(parts[2], 10);
        } else {
          hours = 0; minutes = 0; seconds = 0;
        }
      } else {
        hours = parseInt(matches[1], 10);
        minutes = parseInt(matches[2], 10);
        seconds = parseInt(matches[3], 10);
        var meridiem = matches[4].toUpperCase();
        
        if (meridiem === "PM" && hours < 12) {
          hours += 12;
        } else if (meridiem === "AM" && hours === 12) {
          hours = 0;
        }
      }
    }
    
    return new Date(year, month, day, hours, minutes, seconds, 0);
  } catch (e) {
    return null;
  }
}
