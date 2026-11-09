/**
 * Auth.gs
 * Authentication Module for Google Sheets Backend
 */

/**
 * Handles admin login verification.
 * @param {Object} data JSON payload.
 * @return {TextOutput} JSON response.
 */
function login(data) {
  try {
    var email = data.email;
    var password = data.password;
    
    if (!email || !password) {
      return errorResponse("Email and password are required.");
    }
    
    email = email.toString().trim();
    password = password.toString().trim();
    
    // Fetch row 2 of admin_users to read email and password
    var sheet = getSheet("admin_users");
    if (sheet.getLastRow() < 2) {
      return errorResponse("Configuration row not found on spreadsheet database.");
    }
    
    var dbEmail = sheet.getRange(2, 4).getValue().toString().trim(); // Email is Col D (4)
    var dbPassword = sheet.getRange(2, 5).getValue().toString().trim(); // Password is Col E (5)
    var dbName = sheet.getRange(2, 3).getValue().toString().trim(); // Portfolio Name is Col C (3)
    
    if (dbEmail.toLowerCase() === email.toLowerCase() && dbPassword === password) {
      var token = generateToken(dbEmail, dbPassword);
      return successResponse("Login Success", {
        token: token,
        email: dbEmail,
        portfolioName: dbName
      });
    }
    
    return errorResponse("Invalid Email or Password");
    
  } catch (error) {
    return errorResponse("Login process encountered an error: " + error.toString());
  }
}

/**
 * Generates a session token based on email, password, and spreadsheet metadata.
 * @param {string} email Admin email.
 * @param {string} password Admin password.
 * @return {string} SHA-256 session token.
 */
function generateToken(email, password) {
  var spreadsheetId = "";
  try {
    spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  } catch (e) {
    spreadsheetId = "local_static_salt_value";
  }
  
  var rawToken = email + "|" + password + "|" + spreadsheetId;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawToken, Utilities.Charset.UTF_8);
  
  var token = "";
  for (var i = 0; i < digest.length; i++) {
    var byteVal = digest[i];
    if (byteVal < 0) byteVal += 256;
    var byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    token += byteString;
  }
  return token;
}

/**
 * Validates the session token sent in HTTP requests.
 * @param {string} token Session token to check.
 * @return {boolean} True if validation matches, false otherwise.
 */
function validateToken(token) {
  if (!token) return false;
  
  try {
    var sheet = getSheet("admin_users");
    if (sheet.getLastRow() < 2) return false;
    
    var dbEmail = sheet.getRange(2, 4).getValue().toString().trim();
    var dbPassword = sheet.getRange(2, 5).getValue().toString().trim();
    
    var expectedToken = generateToken(dbEmail, dbPassword);
    return token === expectedToken;
    
  } catch (e) {
    return false;
  }
}
