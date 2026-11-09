/**
 * Contact.gs
 * Contact Messages Module for Google Sheets Backend
 */

/**
 * Validates, checks, and saves new contact message submissions into the contact_messages sheet.
 * @param {Object} data JSON payload.
 * @return {TextOutput} JSON response.
 */
function saveContact(data) {
  try {
    var name = data.name;
    var email = data.email;
    var purpose = data.purpose;
    var message = data.message;
    
    // 1. Validation (Prevent empty fields)
    if (!name || !email || !purpose || !message) {
      return errorResponse("All form fields (Name, Email, Purpose, and Message) are required.");
    }
    
    name = name.toString().trim();
    email = email.toString().trim();
    purpose = purpose.toString().trim();
    message = message.toString().trim();
    
    if (name.length < 2) {
      return errorResponse("Name must be at least 2 characters long.");
    }
    
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email address format.");
    }
    
    if (message.length < 10) {
      return errorResponse("Message must be at least 10 characters long.");
    }
    
    var sheet = getSheet("contact_messages");
    
    // 2. Prevent Duplicate Submissions (Same email/message in the last 2 minutes)
    if (isDuplicate(sheet, email, message)) {
      return errorResponse("Duplicate submission detected. Please wait a couple of minutes before submitting again.");
    }
    
    // 3. Metadata and Formatting
    var ipAddress = data.ipAddress || "Unknown";
    var userAgent = data.userAgent || "";
    var referrer = data.referrer || "Direct";
    
    var uaInfo = parseUserAgent(userAgent);
    
    var now = new Date();
    var submittedDate = formatDate(now);
    var submittedTime = formatTime(now);
    
    // 4. Auto-Increment ID
    var nextId = generateNextID(sheet);
    
    // 5. Build and append row data
    // Columns: ID | Name | Email | Purpose | Message | Latitude | Longitude | Google_Maps_Link | City | State | Country | IP_Address | Browser | Device | Operating_System | Referrer | Submitted_Time | Submitted_Date | Status
    var rowData = [
      nextId,
      name,
      email,
      purpose,
      message,
      data.latitude || "Unknown",
      data.longitude || "Unknown",
      data.googleMapsLink || "Unknown",
      data.city || "Unknown",
      data.state || "Unknown",
      data.country || "Unknown",
      ipAddress,
      uaInfo.browser,
      uaInfo.device,
      uaInfo.os,
      referrer,
      submittedTime,
      submittedDate,
      "Pending"
    ];
    
    sheet.appendRow(rowData);
    
    return successResponse("Message saved successfully.", { id: nextId });
    
  } catch (error) {
    return errorResponse("Error saving message: " + error.toString());
  }
}

/**
 * Checks if a submission with the same email and message exists within the last 2 minutes.
 * Helper function for double submission prevention.
 */
function isDuplicate(sheet, email, message) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  
  var checkRows = Math.min(10, lastRow - 1);
  var startRow = lastRow - checkRows + 1;
  var values = sheet.getRange(startRow, 1, checkRows, sheet.getLastColumn()).getValues();
  
  var now = new Date().getTime();
  
  for (var i = values.length - 1; i >= 0; i--) {
    var rowData = values[i];
    var dbEmail = rowData[2]; // Email is Col C (index 2)
    var dbMessage = rowData[4]; // Message is Col E (index 4)
    var dbTimeVal = rowData[16]; // Submitted_Time is Col Q (index 16)
    var dbDateVal = rowData[17]; // Submitted_Date is Col R (index 17)
    
    if (dbEmail === email && dbMessage === message) {
      try {
        var dbDateTime = parseCustomDateTime(dbDateVal, dbTimeVal);
        if (dbDateTime) {
          var diffMinutes = (now - dbDateTime.getTime()) / (1000 * 60);
          if (diffMinutes >= 0 && diffMinutes < 2) {
            return true; // Duplicate found within 2 minutes
          }
        }
      } catch (e) {
        // Fallback checks
        if ((startRow + i) === lastRow) {
          return true;
        }
      }
    }
  }
  return false;
}
