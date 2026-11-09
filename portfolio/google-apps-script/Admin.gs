/**
 * Admin.gs
 * Admin Configuration Module for Google Sheets Backend
 */

/**
 * Retrieves the website configuration for public rendering (excludes Password for security).
 * @return {TextOutput} JSON response with configuration data.
 */
function getAdminData() {
  try {
    var sheet = getSheet("admin_users");
    if (sheet.getLastRow() < 2) {
      return errorResponse("Configuration row not found in the spreadsheet database.");
    }
    
    // Columns map: Col A(0) = ID, Col B(1) = Navbar_Logo, Col C(2) = Portfolio_Name, Col D(3) = Email, 
    // Col E(4) = Password, Col F(5) = Resume_Link, Col G(6) = Instagram_Link, Col H(7) = LinkedIn_Link,
    // Col I(8) = GitHub_Link, Col J(9) = X_Link, Col K(10) = Phone, Col L(11) = Location, Col M(12) = Updated_At
    var values = sheet.getRange(2, 1, 1, 13).getValues()[0];
    
    var config = {
      navbarLogo: values[1],
      portfolioName: values[2],
      email: values[3],
      resumeLink: values[5],
      instagramLink: values[6],
      linkedinLink: values[7],
      githubLink: values[8],
      xLink: values[9],
      phone: values[10],
      location: values[11],
      updatedAt: values[12]
    };
    
    return successResponse("Admin configuration loaded successfully.", { data: config });
    
  } catch (error) {
    return errorResponse("Failed to load admin data: " + error.toString());
  }
}

/**
 * Handles updating the website configurations in Row 2 of the admin_users sheet.
 * Requires verification of a secure session token before executing.
 * Optimizes database calls using single-row range setValues.
 * @param {Object} data Configuration payload and authorization token.
 * @return {TextOutput} JSON response.
 */
function updateAdminData(data) {
  try {
    var token = data.token;
    
    // 1. Session Token Verification
    if (!validateToken(token)) {
      return errorResponse("Unauthorized. Invalid or expired session token. Please log in again.");
    }
    
    var sheet = getSheet("admin_users");
    if (sheet.getLastRow() < 2) {
      return errorResponse("Configuration row not found in the spreadsheet database.");
    }
    
    var navbarLogo = data.navbarLogo;
    var portfolioName = data.portfolioName;
    var resumeLink = data.resumeLink;
    var instagramLink = data.instagramLink;
    var linkedinLink = data.linkedinLink;
    var githubLink = data.githubLink;
    var xLink = data.xLink;
    var phone = data.phone;
    var location = data.location;
    
    // 2. Form Fields Validations (Prevent empty fields)
    if (!navbarLogo || !portfolioName || !resumeLink || !instagramLink || !linkedinLink || !githubLink || !xLink || !phone || !location) {
      return errorResponse("All configuration parameters are required and cannot be empty.");
    }
    
    navbarLogo = navbarLogo.toString().trim();
    portfolioName = portfolioName.toString().trim();
    resumeLink = resumeLink.toString().trim();
    instagramLink = instagramLink.toString().trim();
    linkedinLink = linkedinLink.toString().trim();
    githubLink = githubLink.toString().trim();
    xLink = xLink.toString().trim();
    phone = phone.toString().trim();
    location = location.toString().trim();
    
    var now = new Date();
    var updatedAtStr = formatDate(now) + " " + formatTime(now);
    
    // 3. Optimize database calls: single-row read-modify-write range write (13 columns)
    var range = sheet.getRange(2, 1, 1, 13);
    var rowValues = range.getValues()[0];
    
    rowValues[1] = navbarLogo;    // Navbar_Logo (Col B)
    rowValues[2] = portfolioName; // Portfolio_Name (Col C)
    rowValues[5] = resumeLink;    // Resume_Link (Col F)
    rowValues[6] = instagramLink; // Instagram_Link (Col G)
    rowValues[7] = linkedinLink;  // LinkedIn_Link (Col H)
    rowValues[8] = githubLink;    // GitHub_Link (Col I)
    rowValues[9] = xLink;         // X_Link (Col J)
    rowValues[10] = phone;        // Phone (Col K)
    rowValues[11] = location;     // Location (Col L)
    rowValues[12] = updatedAtStr; // Updated_At (Col M)
    
    range.setValues([rowValues]);
    
    return successResponse("Portfolio configuration updated successfully.", { updatedAt: updatedAtStr });
    
  } catch (error) {
    return errorResponse("Failed to update config data: " + error.toString());
  }
}
