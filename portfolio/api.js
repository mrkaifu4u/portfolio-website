/**
 * Google Sheets Database API Client
 * Mohamad Kaifoddin Portfolio Website Integration
 */

// Private helper to retrieve client metadata (IP, location details, referrer, and user-agent)
// Incorporates browser Geolocation API coordinates with fallback IP geolocation coordinates.
async function getClientMetadata() {
  let ipAddress = 'Unknown';
  let latitude = 'Unknown';
  let longitude = 'Unknown';
  let googleMapsLink = 'Unknown';
  let city = 'Unknown';
  let state = 'Unknown';
  let country = 'Unknown';
  
  let hasGPS = false;

  // 1. Try Browser Geolocation API
  try {
    console.log("Requesting browser Geolocation coordinates...");
    const coords = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }
      
      // Set a 5-second timeout so the contact form submission is not blocked indefinitely
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
    
    if (coords && coords.latitude && coords.longitude) {
      latitude = coords.latitude.toFixed(6);
      longitude = coords.longitude.toFixed(6);
      googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      hasGPS = true;
      console.log("Browser Geolocation coordinates mapped successfully:", latitude, longitude);
      
      // Convert coordinates into City, State, Country using OpenStreetMap Nominatim API
      try {
        console.log("Resolving reverse geocoding via OpenStreetMap Nominatim...");
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
          headers: {
            'User-Agent': 'MohamadKaifoddinPortfolio/1.0'
          }
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.address) {
            city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.suburb || 'Unknown';
            state = geoData.address.state || 'Unknown';
            country = geoData.address.country || 'Unknown';
            console.log("OpenStreetMap Reverse Geocoding success:", city, state, country);
          }
        }
      } catch (geoErr) {
        console.warn("OpenStreetMap Nominatim Reverse Geocoding request failed:", geoErr);
      }
    }
  } catch (geoErr) {
    console.warn("Browser Geolocation prompt denied or timed out. Falling back to IP-based location...", geoErr);
  }

  // 2. IP Geolocation Lookup
  // Always query IP metadata to collect visitor IP, falling back to coordinates if Geolocation is missing.
  if (!hasGPS) {
    try {
      console.log("Fetching IP and location metadata via ipapi.co...");
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        ipAddress = data.ip || 'Unknown';
        
        if (data.latitude && data.longitude) {
          latitude = data.latitude.toFixed(6);
          longitude = data.longitude.toFixed(6);
          googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
          city = data.city || 'Unknown';
          state = data.region || 'Unknown';
          country = data.country_name || 'Unknown';
          hasGPS = true;
          console.log("IP Geolocation details mapped via ipapi.co:", city, state, country);
        }
      } else {
        throw new Error(`ipapi.co returned status ${res.status}`);
      }
    } catch (err) {
      console.warn('ipapi.co failed. Trying ipwho.is fallback...', err);
      
      // Double Geolocation Fallback using ipwho.is
      try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            ipAddress = data.ip || ipAddress;
            
            if (data.latitude && data.longitude) {
              latitude = data.latitude.toFixed(6);
              longitude = data.longitude.toFixed(6);
              googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
              city = data.city || 'Unknown';
              state = data.region || 'Unknown';
              country = data.country || 'Unknown';
              hasGPS = true;
              console.log("IP Geolocation details mapped via ipwho.is:", city, state, country);
            }
          }
        } else {
          throw new Error(`ipwho.is returned status ${res.status}`);
        }
      } catch (ipwhoErr) {
        console.warn("ipwho.is fallback failed. Trying ipify IP-only fallback...", ipwhoErr);
        
        // Triple Fallback: Fetch raw IP address only via ipify
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            ipAddress = ipData.ip || 'Unknown';
          }
        } catch (ipifyErr) {
          console.error("All IP geolocation lookup operations failed:", ipifyErr);
        }
      }
    }
  } else {
    // If browser GPS succeeded, query IP metadata always to populate the IP Address log column.
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        ipAddress = data.ip || 'Unknown';
      } else {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          ipAddress = ipData.ip || 'Unknown';
        }
      }
    } catch (e) {
      console.warn("Error fetching visitor IP address:", e);
    }
  }
  
  return {
    latitude: latitude,
    longitude: longitude,
    googleMapsLink: googleMapsLink,
    city: city,
    state: state,
    country: country,
    ipAddress: ipAddress,
    referrer: document.referrer || "Portfolio Website",
    userAgent: navigator.userAgent
  };
}

const Api = {
  // Google Apps Script Web App Deployment URL
  url: 'https://script.google.com/macros/s/AKfycbxnA3Ocl7CO48uLDkUyrYjNJ34BwuKW7Wh6UPfWQx5D-EDg5hLYDCR4j5QokbP_H4x6Mg/exec',

  /**
   * Main request handler for POST operations.
   * Sends payload as text/plain to prevent CORS preflight OPTIONS request failures in Apps Script.
   * @param {Object} payload The POST request payload.
   * @return {Promise<Object>} JSON response from server.
   */
  async request(payload) {
    if (!this.url || this.url.includes('YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') || this.url.trim() === '') {
      throw new Error("Google Apps Script Web App URL is not configured yet.");
    }
    
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Network response error (Status: ${response.status}).`);
      }
      
      const data = await response.json();
      if (data.success === false) {
        throw new Error(data.message || 'An error occurred on the database server.');
      }
      
      // Add backward compatibility for index.html checking result === 'success'
      data.result = 'success';
      return data;
    } catch (error) {
      console.error('API POST Request failed:', error);
      throw error;
    }
  },

  /**
   * Fetches public configurations (links, phone, location) from the spreadsheet.
   * @param {string} [token] Optional token.
   * @return {Promise<Object>} Object containing portfolio configurations.
   */
  async getAdminData(token) {
    const payload = {
      action: 'getAdminData'
    };
    if (token) {
      payload.token = token;
    }
    const data = await this.request(payload);
    return data.data;
  },

  /**
   * Sends admin login credentials for validation.
   * @param {string} email Admin email.
   * @param {string} password Admin password.
   * @return {Promise<Object>} Success status and session token.
   */
  async login(email, password) {
    return await this.request({
      action: 'login',
      email: email,
      password: password
    });
  },

  /**
   * Submits a visitor message.
   * @param {Object} contactData Object containing name, email, purpose, and message.
   * @return {Promise<Object>} Success status and message ID.
   */
  async saveContact(contactData) {
    const metadata = await getClientMetadata();
    const payload = {
      action: 'saveContact',
      name: contactData.name,
      email: contactData.email,
      purpose: contactData.purpose,
      message: contactData.message,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      googleMapsLink: metadata.googleMapsLink,
      city: metadata.city,
      state: metadata.state,
      country: metadata.country,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      referrer: metadata.referrer
    };
    return await this.request(payload);
  },

  /**
   * Updates row 2 of admin_users configuration.
   * @param {string} token Session verification token.
   * @param {Object} adminData Updated configuration fields.
   * @return {Promise<Object>} Success status.
   */
  async updateAdmin(token, adminData) {
    const payload = {
      action: 'updateAdmin',
      token: token,
      navbarLogo: adminData.navbarLogo,
      portfolioName: adminData.portfolioName,
      resumeLink: adminData.resumeLink,
      instagramLink: adminData.instagramLink,
      linkedinLink: adminData.linkedinLink,
      githubLink: adminData.githubLink,
      xLink: adminData.xLink,
      phone: adminData.phone,
      location: adminData.location
    };
    return await this.request(payload);
  }
};
