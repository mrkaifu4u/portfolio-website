/**
 * Code.gs
 * API Router Module for Google Apps Script Web App
 */

/**
 * Handles HTTP GET requests.
 * Used for fetching the configuration data dynamically on website load.
 * @param {Object} e Request parameters.
 * @return {TextOutput} JSON response.
 */
function doGet(e) {
  try {
    var action = e.parameter.action;
    if (!action) {
      return errorResponse("Action parameter is missing.");
    }
    
    if (action === "getAdminData") {
      return getAdminData();
    }
    
    return errorResponse("Invalid GET action: " + action);
  } catch (error) {
    return errorResponse("Internal server error (GET): " + error.toString());
  }
}

/**
 * Handles HTTP POST requests.
 * Used for admin login, configuration updates, and saving contact form submissions.
 * @param {Object} e HTTP request event object.
 * @return {TextOutput} JSON response.
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return errorResponse("Empty post body.");
    }
    
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return errorResponse("Malformed JSON payload.");
    }
    
    var action = data.action;
    if (!action) {
      return errorResponse("Action parameter is missing in payload.");
    }
    
    if (action === "login") {
      return login(data);
    } else if (action === "getAdminData") {
      return getAdminData();
    } else if (action === "updateAdmin") {
      return updateAdminData(data);
    } else if (action === "saveContact") {
      return saveContact(data);
    }
    
    return errorResponse("Invalid POST action: " + action);
  } catch (error) {
    return errorResponse("Internal server error (POST): " + error.toString());
  }
}
