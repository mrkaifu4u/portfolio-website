/**
 * API Routing & Dispatch Layer
 */

/**
 * Routes GET requests.
 * @param {Object} e HTTP request event object.
 * @return {TextOutput} JSON response.
 */
function handleGet(e) {
  var action = e.parameter.action;
  if (!action) {
    return jsonResponse({ result: "error", message: "Action parameter is missing." });
  }
  
  if (action === "getAdminData") {
    return getAdminConfiguration();
  }
  
  return jsonResponse({ result: "error", message: "Invalid GET action: " + action });
}

/**
 * Routes POST requests.
 * @param {Object} e HTTP request event object.
 * @return {TextOutput} JSON response.
 */
function handlePost(e) {
  if (!e.postData || !e.postData.contents) {
    return jsonResponse({ result: "error", message: "Empty post body." });
  }
  
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ result: "error", message: "Malformed JSON payload." });
  }
  
  var action = data.action;
  if (!action) {
    return jsonResponse({ result: "error", message: "Action parameter is missing in payload." });
  }
  
  if (action === "login") {
    return handleLogin(data);
  } else if (action === "saveContact") {
    return handleSaveContact(data);
  } else if (action === "updateAdmin") {
    return handleUpdateAdmin(data);
  }
  
  return jsonResponse({ result: "error", message: "Invalid POST action: " + action });
}
